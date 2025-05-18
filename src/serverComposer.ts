import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  McpServer,
  type ResourceMetadata
} from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  Implementation,
  Tool,
  CallToolResult,
  Resource,
  Prompt
} from '@modelcontextprotocol/sdk/types.js'
import {
  SSEClientTransport,
  type SSEClientTransportOptions
} from '@modelcontextprotocol/sdk/client/sse.js'
import {
  StdioClientTransport,
  type StdioServerParameters
} from '@modelcontextprotocol/sdk/client/stdio.js'
import { jsonSchemaToZod } from './utils/schemaConverter'
import { formatLog } from './utils/console'

type ConnectionConfig =
  | {
    type: 'sse'
    url: URL
    params: SSEClientTransportOptions
    tools: string[]
  }
  | {
    type: 'stdio'
    params: StdioServerParameters
    tools: string[]
  }

interface ToolChainStep {
  toolName: string;
  args: any;
  outputMapping?: {
    [key: string]: string; // 将当前步骤的输出映射到下一个步骤的输入
  };
  fromStep?: number;
}

interface ToolChainOutput {
  steps?: number[];  // 指定要输出的步骤索引，如果为空则输出所有步骤
  final?: boolean;   // 是否只输出最后一步
}

interface ToolChain {
  name: string;
  steps: ToolChainStep[];
  description?: string;
  output?: ToolChainOutput;  // 添加输出配置
}

export class McpServerComposer {
  public readonly server: McpServer
  private readonly targetClients: Map<
    string,
    {
      clientInfo: Implementation
      config: ConnectionConfig
    }
  > = new Map()
  private readonly clientTools: Map<string, Set<string>> = new Map()

  constructor(serverInfo: Implementation) {
    this.server = new McpServer(serverInfo)
  }

  async add(
    config: ConnectionConfig,
    clientInfo: Implementation,
    skipRegister = false,
    retryCount = 0
  ): Promise<void> {
    const targetClient = new Client(clientInfo)
    const transport =
      config.type === 'sse'
        ? new SSEClientTransport(config.url)
        : new StdioClientTransport(config.params)

    try {
      await targetClient.connect(transport)
    } catch (error) {
      if (retryCount >= 2) {
        formatLog(
          'ERROR',
          `Connection failed after 2 retries: ${config.type === 'sse' ? config.url : config.params.command
          } -> ${clientInfo.name}\n` +
          `Reason: ${(error as Error).message}\n` +
          `Skipping connection...`
        )
        return
      }

      formatLog(
        'ERROR',
        `Connection failed: ${config.type === 'sse' ? config.url : config.params.command
        } -> ${clientInfo.name}\n` +
        `Reason: ${(error as Error).message}\n` +
        `Will retry in 15 seconds... (Attempt ${retryCount + 1}/2)`
      )

      // If the connection fails, retry after 15 seconds
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.add(config, clientInfo, skipRegister, retryCount + 1))
        }, 15000)
      })
    }

    formatLog(
      'INFO',
      `Successfully connected to server: ${config.type === 'sse' ? config.url : config.params.command
      } (${clientInfo.name})`
    )

    const name =
      config.type === 'sse' ? config.url.toString() : config.params.command

    this.targetClients.set(name, { clientInfo, config })

    if (skipRegister) {
      formatLog('INFO', `Skipping capability registration: ${name}`)
      return
    }

    const capabilities = await targetClient.getServerCapabilities()

    formatLog(
      'INFO',
      `Starting server capability registration: ${name} ${JSON.stringify(
        capabilities,
        null,
        2
      )}`
    )

    if (capabilities?.tools) {
      try {
        const tools = await targetClient.listTools()

        this.composeTools(tools.tools, name)

        formatLog(
          'INFO',
          `Tool registration completed [${name}]: ${tools.tools.length} tools in total`
        )
      } catch (error) {
        formatLog(
          'ERROR',
          `Tool registration failed: ${name} ${JSON.stringify(error, null, 2)}`
        )
      }
    }

    if (capabilities?.resources) {
      try {
        const resources = await targetClient.listResources()
        this.composeResources(resources.resources, name)

        formatLog(
          'INFO',
          `Resource registration completed [${name}]: ${resources.resources.length} resources in total`
        )
      } catch (error) {
        formatLog(
          'ERROR',
          `Resource registration failed: ${name} ${JSON.stringify(
            error,
            null,
            2
          )}`
        )
      }
    }

    if (capabilities?.prompts) {
      try {
        const prompts = await targetClient.listPrompts()
        this.composePrompts(prompts.prompts, name)

        formatLog(
          'INFO',
          `Prompt registration completed [${name}]: ${prompts.prompts.length} prompts in total`
        )
      } catch (error) {
        formatLog(
          'ERROR',
          `Prompt registration failed: ${name} ${JSON.stringify(
            error,
            null,
            2
          )}`
        )
      }
    }

    formatLog(
      'INFO',
      `All capabilities registration completed for server ${name}`
    )
    targetClient.close()
  }

  composeToolChain(toolChain: ToolChain) {
    this.server.tool(
      toolChain.name,
      toolChain.description ?? 'Execute a chain of tools',
      {},
      async () => {
        const results: any[] = [];
        const clientsMap = new Map<string, Client>();

        try {
          for (let i = 0; i < toolChain.steps.length; i++) {
            const step = toolChain.steps[i];
            // @ts-ignore
            const registeredTool = this.server._registeredTools[step.toolName];
            if (!registeredTool) {
              throw new Error(`Tool not found: ${step.toolName}`);
            }

            formatLog(
              'DEBUG',
              `Executing chain step ${i}: ${step.toolName}\n`
            );

            if (step.outputMapping) {
              const sourceResult = step.fromStep !== undefined
                ? results[step.fromStep]
                : results[results.length - 1];

              if (sourceResult) {
                for (const [key, path] of Object.entries(step.outputMapping)) {
                  try {
                    const value = this.getNestedValue(sourceResult, path);
                    if (value !== undefined) {
                      step.args[key] = value;
                    } else {
                      formatLog(
                        'INFO',
                        `Output mapping path "${path}" returned undefined for step ${i}`
                      );
                    }
                  } catch (error) {
                    formatLog(
                      'ERROR',
                      `Failed to map output for step ${i}: ${error.message}`
                    );
                  }
                }
              }
            }

            let result;
            try {
              if (registeredTool.needsClient) {
                let foundClientName: string | undefined;

                for (const [clientName, _] of this.targetClients.entries()) {
                  // 使用 clientTools 来判断客户端是否真的支持这个工具
                  const supportedTools = this.clientTools.get(clientName)
                  if (supportedTools?.has(step.toolName)) {
                    foundClientName = clientName;
                    break;
                  }
                }

                if (!foundClientName) {
                  throw new Error(`No client found for tool: ${step.toolName}`);
                }

                // 复用或创建客户端连接
                let client = clientsMap.get(foundClientName);
                if (!client) {
                  const clientItem = this.targetClients.get(foundClientName);
                  if (!clientItem) {
                    throw new Error(`Client configuration not found for: ${foundClientName}`);
                  }
                  client = new Client(clientItem.clientInfo);
                  await client.connect(this.createTransport(clientItem.config));
                  clientsMap.set(foundClientName, client);
                } else {
                  // console.log('复用',foundClientName)
                }

                result = await registeredTool.chainExecutor(step.args, client);
              } else {
                // 本地工具直接调用
                result = await registeredTool.callback(step.args);
              }

              // 确保结果不是undefined
              results.push(result || { content: [{ type: "text", text: "" }] });
            } catch (error) {
              formatLog(
                'ERROR',
                `Step ${i} (${step.toolName}) execution failed: ${error.message}`
              );
              // 在错误时添加一个空结果
              results.push({ content: [{ type: "text", text: `Error: ${error.message}` }] });
            }

          }

          formatLog(
            'DEBUG',
            `Chain execution completed`
          );

          // 处理输出结果时添加安全检查
          let outputResults: any[] = [];
          try {
            if (toolChain.output?.final) {
              const finalResult = results[results.length - 1];
              outputResults = finalResult ? [finalResult] : [];
            } else if (toolChain.output?.steps && toolChain.output.steps.length > 0) {
              outputResults = toolChain.output.steps
                .filter(stepIndex => stepIndex >= 0 && stepIndex < results.length)
                .map(stepIndex => results[stepIndex])
                .filter(result => result !== undefined);
            } else {
              outputResults = results.filter(result => result !== undefined);
            }
          } catch (error) {
            formatLog(
              'ERROR',
              `Failed to process output results: ${error.message}`
            );
            outputResults = [];
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(outputResults || [])
            }]
          };
        } finally {
          // 关闭所有客户端连接
          for (const client of clientsMap.values()) {
            await client.close();
          }
        }
      }
    );
  }

  private getNestedValue(obj: any, path: string): any {
    try {
      return path.split('.')
        .reduce((current, key) => {
          if (current === undefined || current === null) {
            return undefined;
          }
          return current[key];
        }, obj);
    } catch (error) {
      formatLog(
        'ERROR',
        `Failed to get nested value for path "${path}": ${error.message}`
      );
      return undefined;
    }
  }

  listTargetClients() {
    return Array.from(this.targetClients.values())
  }

  private createTransport(config: ConnectionConfig) {
    return config.type === 'sse'
      ? new SSEClientTransport(config.url)
      : new StdioClientTransport(config.params)
  }

  private composeTools(tools: Tool[], name: string) {
    //@ts-ignore
    const existingTools = this.server._registeredTools
    // 记录这个客户端支持的工具
    const toolSet = new Set<string>()
    for (const tool of tools) {
      toolSet.add(tool.name)
      if (existingTools[tool.name]) {
        continue
      }
      const schemaObject = jsonSchemaToZod(tool.inputSchema)

      // 创建工具的执行函数
      const toolExecutor = async (args: any, client?: Client) => {
        let needToClose = false;
        let toolClient = client;

        if (!toolClient) {
          // 如果没有传入client，说明是直接调用，需要创建新的连接
          const clientItem = this.targetClients.get(name);
          if (!clientItem) {
            throw new Error(`Client for ${name} not found`);
          }

          toolClient = new Client(clientItem.clientInfo);
          await toolClient.connect(this.createTransport(clientItem.config));
          needToClose = true;  // 标记需要关闭连接
        }

        formatLog(
          'DEBUG',
          `Calling tool: ${tool.name}\n`
        );

        const result = await toolClient.callTool({
          name: tool.name,
          arguments: args
        });
        // if(tool.name=="browser_execute_javascript"){
        //   console.log(args)
        //   console.log(result)
        // }

        if (needToClose) {
          await toolClient.close();
        }

        return result as CallToolResult;
      };

      // 注册工具
      this.server.tool(
        tool.name,
        tool.description ?? '',
        schemaObject,
        async args => toolExecutor(args)  // 直接调用模式
      );

      // 保存执行函数和标记为需要客户端的工具
      // @ts-ignore
      this.server._registeredTools[tool.name].chainExecutor = toolExecutor;
      // @ts-ignore
      this.server._registeredTools[tool.name].needsClient = true;  // 标记为需要客户端
    }
    this.clientTools.set(name, toolSet)
  }

  private composeResources(resources: Resource[], name: string) {
    // @ts-ignore
    const existingResources = this.server._registeredResources
    //  console.log(existingResources,resources)
    for (const resource of resources) {
      if (existingResources[resource.uri]) {
        continue
      }
      this.server.resource(
        resource.name,
        resource.uri,
        { description: resource.description, mimeType: resource.mimeType },
        async uri => {
          const clientItem = this.targetClients.get(name)
          if (!clientItem) {
            throw new Error(`Client for ${name} not found`)
          }

          const client = new Client(clientItem.clientInfo)
          await client.connect(this.createTransport(clientItem.config))

          const result = await client.readResource({
            uri: uri.toString(),
            _meta: resource._meta as ResourceMetadata
          })
          await client.close()
          return result
        }
      )
    }
  }

  private composePrompts(prompts: Prompt[], name: string) {
    // @ts-ignore
    const existingPrompts = this.server._registeredPrompts
    for (const prompt of prompts) {
      if (existingPrompts[prompt.name]) {
        continue
      }
      const argsSchema = jsonSchemaToZod(prompt.arguments)
      this.server.prompt(
        prompt.name,
        prompt.description ?? '',
        argsSchema,
        async args => {
          const clientItem = this.targetClients.get(name)
          if (!clientItem) {
            throw new Error(`Client for ${name} not found`)
          }

          const client = new Client(clientItem.clientInfo)
          await client.connect(this.createTransport(clientItem.config))

          const result = await client.getPrompt({
            name: prompt.name,
            arguments: args
          })
          await client.close()
          return result
        }
      )
    }
  }

  private handleTargetServerClose(
    name: string,
    config: ConnectionConfig,
    clientInfo: Implementation
  ) {
    return () => {
      this.targetClients.delete(name)

      formatLog(
        'ERROR',
        `Server connection lost:\n` +
        `- Name: ${name}\n` +
        `- Type: ${config.type}\n` +
        `- Config: ${config.type === 'sse' ? config.url : config.params.command
        }\n` +
        `- Client: ${clientInfo.name}\n` +
        `Will try to reconnect in 10 seconds...`
      )

      return this.add(config, clientInfo, true)
    }
  }

  async disconnectAll() {
    for (const client of this.targetClients.keys()) {
      await this.disconnect(client)
    }
  }

  async disconnect(clientName: string) {
    const client = this.targetClients.get(clientName)
    if (client) {
      this.targetClients.delete(clientName)
    }
  }
}
