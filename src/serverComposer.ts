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
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { jsonSchemaToZod } from './utils/schemaConverter'
import { formatLog } from './utils/console'

export class McpServerComposer {
  public readonly server: McpServer
  private readonly targetClients: Map<
    string,
    {
      clientInfo: Implementation
      url: URL
    }
  > = new Map()

  constructor (serverInfo: Implementation) {
    this.server = new McpServer(serverInfo)
  }

  async add (
    targetServerUrl: URL,
    clientInfo: Implementation,
    skipRegister = false
  ): Promise<void> {
    const targetClient = new Client(clientInfo)
    const targetTransport = new SSEClientTransport(targetServerUrl)
    try {
      await targetClient.connect(targetTransport)
    } catch (error) {
      formatLog(
        'ERROR',
        `Connection failed: ${targetServerUrl} -> ${clientInfo.name}\n` +
          `Reason: ${(error as Error).message}\n` +
          `Will retry in 15 seconds...`
      )

      // If the connection fails, retry after 15 seconds
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(
            this.add(targetServerUrl, clientInfo, skipRegister)
          )
        }, 15000)
      })
    }

    formatLog(
      'INFO',
      `Successfully connected to server: ${targetServerUrl} (${clientInfo.name})`
    )

    const name = targetServerUrl.toString()

    this.targetClients.set(name, { clientInfo, url: targetServerUrl })

    if (skipRegister) {
      formatLog('INFO', `Skipping capability registration: ${name}`)
      return
    }

    formatLog('INFO', `Starting server capability registration: ${name}`)
    const tools = await targetClient.listTools()
    this.composeTools(tools.tools, name)

    formatLog('INFO', `Tool registration completed [${name}]: ${tools.tools.length} tools in total`)

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

    formatLog('INFO', `All capabilities registration completed for server ${name}`)
    targetClient.close() // We don't have to keep the client open
  }

  listTargetClients () {
    return Array.from(this.targetClients.values())
  }

  private composeTools (tools: Tool[], name: string) {
    for (const tool of tools) {
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
          await client.connect(new SSEClientTransport(clientItem.url))
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
    for (const resource of resources) {
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
          await client.connect(new SSEClientTransport(clientItem.url))

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
    for (const prompt of prompts) {
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
          await client.connect(new SSEClientTransport(clientItem.url))

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
    targetServerUrl: URL,
    clientInfo: Implementation
  ) {
    return () => {
      this.targetClients.delete(name)

      formatLog(
        'ERROR',
        `Server connection lost:\n` +
          `- Name: ${name}\n` +
          `- URL: ${targetServerUrl}\n` +
          `- Client: ${clientInfo.name}\n` +
          `Will try to reconnect in 10 seconds...`
      )

      return this.add(targetServerUrl, clientInfo, true)
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
