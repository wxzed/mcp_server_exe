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
    }
  | {
      type: 'stdio'
      params: StdioServerParameters
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

  constructor (serverInfo: Implementation) {
    this.server = new McpServer(serverInfo)
  }

  async add (
    config: ConnectionConfig,
    clientInfo: Implementation,
    skipRegister = false
  ): Promise<void> {
    const targetClient = new Client(clientInfo)
    const transport =
      config.type === 'sse'
        ? new SSEClientTransport(config.url)
        : new StdioClientTransport(config.params)

    try {
      await targetClient.connect(transport)
    } catch (error) {
      formatLog(
        'ERROR',
        `Connection failed: ${
          config.type === 'sse' ? config.url : config.params.command
        } -> ${clientInfo.name}\n` +
          `Reason: ${(error as Error).message}\n` +
          `Will retry in 15 seconds...`
      )

      // If the connection fails, retry after 15 seconds
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.add(config, clientInfo, skipRegister))
        }, 15000)
      })
    }

    formatLog(
      'INFO',
      `Successfully connected to server: ${
        config.type === 'sse' ? config.url : config.params.command
      } (${clientInfo.name})`
    )

    const name =
      config.type === 'sse' ? config.url.toString() : config.params.command

    this.targetClients.set(name, { clientInfo, config })

    if (skipRegister) {
      formatLog('INFO', `Skipping capability registration: ${name}`)
      return
    }

    formatLog('INFO', `Starting server capability registration: ${name}`)
    const tools = await targetClient.listTools()
    this.composeTools(tools.tools, name)

    formatLog(
      'INFO',
      `Tool registration completed [${name}]: ${tools.tools.length} tools in total`
    )

    const resources = await targetClient.listResources()
    this.composeResources(resources.resources, name)

    formatLog(
      'INFO',
      `Resource registration completed [${name}]: ${resources.resources.length} resources in total`
    )

    const prompts = await targetClient.listPrompts()
    this.composePrompts(prompts.prompts, name)

    formatLog(
      'INFO',
      `Prompt registration completed [${name}]: ${prompts.prompts.length} prompts in total`
    )

    formatLog(
      'INFO',
      `All capabilities registration completed for server ${name}`
    )
    targetClient.close() // We don't have to keep the client open
  }

  listTargetClients () {
    return Array.from(this.targetClients.values())
  }

  private createTransport (config: ConnectionConfig) {
    return config.type === 'sse'
      ? new SSEClientTransport(config.url)
      : new StdioClientTransport(config.params)
  }

  private composeTools (tools: Tool[], name: string) {
    // 获取this.server的所有已有的tool，如果tool.name与tools中的tool.
    // @ts-ignore
    const existingTools = this.server._registeredTools
    // console.log(existingTools)
    for (const tool of tools) {
      if ( existingTools[tool.name]) {
        continue
      }
      const schemaObject = jsonSchemaToZod(tool.inputSchema)
      this.server.tool(
        tool.name,
        tool.description ?? '',
        schemaObject,
        async args => {
          const clientItem = this.targetClients.get(name)
          if (!clientItem) {
            throw new Error(`Client for ${name} not found`)
          }

          const client = new Client(clientItem.clientInfo)
          await client.connect(this.createTransport(clientItem.config))
          formatLog(
            'DEBUG',
            `Calling tool: ${tool.name}\n` +
              `Arguments: ${JSON.stringify(args, null, 2)}`
          )

          const result = await client.callTool({
            name: tool.name,
            arguments: args
          })
          await client.close()
          return result as CallToolResult
        }
      )
    }
  }

  private composeResources (resources: Resource[], name: string) {
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

  private composePrompts (prompts: Prompt[], name: string) {
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

  private handleTargetServerClose (
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
          `- Config: ${
            config.type === 'sse' ? config.url : config.params.command
          }\n` +
          `- Client: ${clientInfo.name}\n` +
          `Will try to reconnect in 10 seconds...`
      )

      return this.add(config, clientInfo, true)
    }
  }

  async disconnectAll () {
    for (const client of this.targetClients.keys()) {
      await this.disconnect(client)
    }
  }

  async disconnect (clientName: string) {
    const client = this.targetClients.get(clientName)
    if (client) {
      this.targetClients.delete(clientName)
    }
  }
}
