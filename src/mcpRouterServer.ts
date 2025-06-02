import type { Implementation } from '@modelcontextprotocol/sdk/types.js'
import { McpServerComposer } from './serverComposer'
import { ExpressSSEServerTransport } from './expressSseTransport'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { McpServerType } from './utils/schemas'
import express from 'express'
import cors from 'cors'
import type { Express } from 'express'
import { formatLog } from './utils/console'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import type { Server } from 'http'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const NAMESPACE_SEPARATOR = '.'

export class McpRouterServer {
  private app!: Express
  private httpServer: Server | null = null
  private readonly transportType: 'sse' | 'stdio'
  private readonly baseServerInfo: Implementation
  private parsedConfig: {
    targetServers: McpServerType[]
    toolChains: any[]
    toolsFilter: string[]
    namespace: string
    configureMcp: Function | null
  } | null = null

  private readonly sseSessions: Map<
    string,
    {
      composer: McpServerComposer
      server: McpServer
      transport: ExpressSSEServerTransport
    }
  > = new Map()

  private stdioComposer: McpServerComposer | null = null
  private stdioServer: McpServer | null = null
  private stdioTransport: StdioServerTransport | null = null

  // 添加默认SSE服务器实例，用于WebSocket等场景
  private defaultSseComposer: McpServerComposer | null = null
  private defaultSseServer: McpServer | null = null

  constructor (
    serverInfo: Implementation,
    private readonly serverOptions: {
      port?: number
      host?: string
      transportType?: 'sse' | 'stdio'
    }
  ) {
    this.baseServerInfo = serverInfo
    this.transportType = serverOptions.transportType ?? 'sse'

    // 初始化默认服务器实例
    if (this.transportType === 'sse') {
      this.initSseServer()
    } else if (this.transportType === 'stdio') {
      this.initStdioServer()
    }
  }

  initSseServer () {
    this.defaultSseComposer = new McpServerComposer(this.baseServerInfo)
    this.defaultSseServer = this.defaultSseComposer.server
  }

  initStdioServer () {
    this.stdioComposer = new McpServerComposer(this.baseServerInfo)
    this.stdioServer = this.stdioComposer.server
    this.stdioTransport = new StdioServerTransport()
  }

  private async setupRoutes () {
    if (this.transportType === 'stdio') {
      formatLog('INFO', 'Initializing server in stdio mode...')

      this.stdioServer.connect(this.stdioTransport)
      formatLog('INFO', 'Server initialized and connected in stdio mode')
      return
    }

    // SSE Mode
    this.app = express()
    const corsOptions = {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 186400
    }

    this.app.use((req, res, next) => {
      req.setTimeout(240000 * 10)
      res.setTimeout(240000 * 10)
      next()
    })

    this.app.use(cors(corsOptions))
    this.app.use(express.json())

    this.app.get('/', async (_, res) => {
      formatLog('INFO', 'New SSE connection request received.')
      const composer = new McpServerComposer(this.baseServerInfo)
      const server = composer.server
      const transport = new ExpressSSEServerTransport('/sessions')

      if (this.parsedConfig) {
        await this._applyConfigurationToComposer(
          composer,
          server,
          this.parsedConfig.configureMcp
        )
      }

      server.connect(transport)

      transport.onclose = () => {
        formatLog(
          'INFO',
          `SSE transport for session ${transport.sessionId} closed.`
        )
        const sessionData = this.sseSessions.get(transport.sessionId)
        if (sessionData) {
          formatLog(
            'INFO',
            `Closing McpServer and cleaning up resources for session ${transport.sessionId}.`
          )
          sessionData.server.close()
          this.sseSessions.delete(transport.sessionId)
          formatLog('INFO', `Session ${transport.sessionId} fully cleaned up.`)
        } else {
          formatLog(
            'INFO',
            `onclose called for session ${transport.sessionId}, but session not found in map.`
          )
        }
      }

      this.sseSessions.set(transport.sessionId, {
        composer,
        server,
        transport
      })
      formatLog(
        'INFO',
        `Session ${transport.sessionId} opened and McpServer instance created.`
      )
      transport.handleSSERequest(res)
    })

    this.app.post('/sessions', (req, res) => {
      const sessionId = req.query.sessionId as string
      const sessionData = this.sseSessions.get(sessionId)

      if (!sessionData) {
        formatLog('INFO', `Invalid or unknown session ID: ${sessionId}`)
        res.status(404).send('Session not found or invalid session ID')
        return
      }

      sessionData.transport.handlePostMessage(req, res)
    })

    this.app.use((_, res) => {
      res.status(404).send('Not found')
    })

    this.app.use(
      (err: Error, _, res: express.Response, next: express.NextFunction) => {
        formatLog('ERROR', `Unhandled error: ${err.message} ${err.stack ?? ''}`)
        res.status(500).send('Internal server error')
        next()
      }
    )
  }

  parseConfig (config: any) {
    const mcpServers = config?.mcpServers || {}

    const targetServers: McpServerType[] = []
    for (const serverName in mcpServers) {
      const serverConfig = mcpServers[serverName]
      const targetServer: McpServerType = {
        name: serverName,
        type: serverConfig.url ? 'sse' : 'stdio',
        url: serverConfig.url,
        params: serverConfig.url
          ? {}
          : {
              ...serverConfig
            }
      }
      targetServers.push(targetServer)
    }
    return targetServers
  }

  private async _applyConfigurationToComposer (
    composer: McpServerComposer,
    server: McpServer,
    configureMcp: Function | null
  ) {
    if (!this.parsedConfig) {
      formatLog('DEBUG', 'No parsed config available to apply to composer.')
      return
    }

    composer.namespace = this.parsedConfig.namespace

    if (typeof configureMcp === 'function') {
      configureMcp(server, ResourceTemplate, z)
    }

    for (const targetServer of this.parsedConfig.targetServers) {
      let mcpClientConfig
      if (targetServer.type === 'sse') {
        mcpClientConfig = {
          name: targetServer.name,
          type: 'sse',
          url: new URL(targetServer.url!),
          params: targetServer.params,
          tools: targetServer.tools
        }
      } else {
        mcpClientConfig = {
          name: targetServer.name,
          type: 'stdio',
          params: targetServer.params,
          tools: targetServer.tools
        }
      }
      await composer.add(mcpClientConfig, {
        name:
          targetServer.name ??
          (targetServer.url
            ? new URL(targetServer.url).hostname
            : 'stdio-server'),
        version: targetServer.version ?? '1.0.0',
        description: targetServer.description ?? ''
      })
    }

    for (const toolChain of this.parsedConfig.toolChains) {
      composer.composeToolChain(toolChain)
    }

    const registeredTools = server['_registeredTools']

    if (this.parsedConfig.toolsFilter.length > 0) {
      for (const name in registeredTools) {
        if (!this.parsedConfig.toolsFilter.includes(name)) {
          ;(registeredTools[name] as any).disable()
        }
      }
    }

    if (Array.isArray(this.parsedConfig.toolChains)) {
      for (const toolChain of this.parsedConfig.toolChains) {
        if (registeredTools[toolChain.name]) {
          ;(registeredTools[toolChain.name] as any).enable()
        }
      }
    }
  }

  public getActiveServer (): McpServer {
    if (this.transportType === 'stdio' && this.stdioServer) {
      return this.stdioServer
    }
    if (this.transportType === 'sse' && this.defaultSseServer) {
      return this.defaultSseServer
    }
    throw new Error('No active server available')
  }

  async importMcpConfig (config: any, configureMcp: Function | null) {
    const targetServers = this.parseConfig(config)
    const toolChains = config?.toolChains || []
    const namespace = config.namespace || NAMESPACE_SEPARATOR
    const toolsFilter = config?.tools || []

    this.parsedConfig = {
      targetServers,
      toolChains,
      toolsFilter,
      namespace,
      configureMcp
    }

    // 为默认SSE服务器应用配置
    if (
      this.transportType === 'sse' &&
      this.defaultSseComposer &&
      this.defaultSseServer
    ) {
      await this._applyConfigurationToComposer(
        this.defaultSseComposer,
        this.defaultSseServer,
        this.parsedConfig.configureMcp
      )
    }

    // 为stdio服务器应用配置
    if (
      this.transportType === 'stdio' &&
      this.stdioComposer &&
      this.stdioServer
    ) {
      formatLog(
        'INFO',
        'Applying new configuration to existing stdio server instance.'
      )
      await this._applyConfigurationToComposer(
        this.stdioComposer,
        this.stdioServer,
        this.parsedConfig.configureMcp
      )
    }
  }

  async start () {
    await this.setupRoutes()

    if (this.transportType === 'stdio') {
      formatLog('INFO', 'Server running in stdio mode.')
      return
    }

    const port = this.serverOptions.port ?? 3003
    const host = this.serverOptions.host ?? '0.0.0.0'

    this.httpServer = this.app.listen(port, host, () => {
      const hostAddress = host === '0.0.0.0' ? '127.0.0.1' : host
      const serverUrl = `http://${hostAddress}:${port}`

      const conceptualServerName =
        this.baseServerInfo.name || 'mcpSessionServer'

      const mcpConfigDisplay = {
        mcpServers: {
          [conceptualServerName]: {
            url: serverUrl,
            description:
              'Connect to this URL for an SSE-based MCP session. Each connection gets a dedicated server instance.'
          }
        }
      }
      if (this.parsedConfig) {
        mcpConfigDisplay['routerConfiguration'] = {
          namespace: this.parsedConfig.namespace
        }
      }

      formatLog(
        'INFO',
        `\n\nConceptual MCP Server Config (new instance per SSE connection): ${JSON.stringify(
          mcpConfigDisplay,
          null,
          2
        )}\n\n`
      )
      formatLog(
        'INFO',
        `\n\nMCP Router (SSE) listening on ${serverUrl}. Send GET to / for new session, POST to /sessions?sessionId=... for messages.\n\n`
      )
    })

    this.httpServer.on('error', error => {
      formatLog('ERROR', `HTTP server error: ${error.message}`)
    })
  }

  async close (): Promise<void> {
    try {
      formatLog('INFO', 'Shutting down McpRouterServer...')

      if (this.transportType === 'sse') {
        // 关闭默认SSE服务器
        if (this.defaultSseServer) {
          try {
            await this.defaultSseServer.close()
            this.defaultSseServer = null
            this.defaultSseComposer = null
          } catch (error) {
            formatLog(
              'ERROR',
              `Error closing default SSE server: ${(error as Error).message}`
            )
          }
        }

        const sseServerClosePromises = Array.from(
          this.sseSessions.values()
        ).map(async sessionData => {
          try {
            formatLog(
              'INFO',
              `Closing McpServer for session ${sessionData.transport.sessionId}...`
            )
            await sessionData.server.close()
          } catch (error) {
            formatLog(
              'ERROR',
              `Error closing McpServer for session ${
                sessionData.transport.sessionId
              }: ${(error as Error).message}`
            )
          }
        })
        await Promise.all(sseServerClosePromises)

        if (this.sseSessions.size > 0) {
          formatLog(
            'INFO',
            `${this.sseSessions.size} SSE sessions still in map after close attempts. Forcibly clearing.`
          )
          this.sseSessions.clear()
        }
      }

      if (this.transportType === 'stdio' && this.stdioServer) {
        formatLog('INFO', 'Closing stdio McpServer...')
        try {
          await this.stdioTransport?.close()
          await this.stdioServer.close()
        } catch (error) {
          formatLog(
            'ERROR',
            `Error closing stdio McpServer: ${(error as Error).message}`
          )
        }
        this.stdioServer = null
        this.stdioComposer = null
        this.stdioTransport = null
      }

      if (this.httpServer) {
        formatLog('INFO', 'Closing HTTP server...')
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close(err => {
            if (err) {
              formatLog('ERROR', `Error closing HTTP server: ${err.message}`)
              reject(err)
            } else {
              formatLog('INFO', 'HTTP server closed successfully.')
              this.httpServer = null
              resolve()
            }
          })
        })
      }

      formatLog('INFO', 'McpRouterServer shut down completely.')
    } catch (error) {
      formatLog(
        'ERROR',
        `Critical error during McpRouterServer shutdown: ${
          (error as Error).message
        }`
      )
      throw error
    }
  }
}
