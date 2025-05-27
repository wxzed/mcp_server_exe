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

const NAMESPACE_SEPARATOR = '.'

export class McpRouterServer {
  private readonly serverComposer: McpServerComposer
  private readonly transports: Record<
    string,
    ExpressSSEServerTransport | StdioServerTransport
  > = {}
  private app: Express
  private httpServer: Server | null = null
  private readonly transportType: 'sse' | 'stdio'
  public readonly server: McpServer
  constructor (
    serverInfo: Implementation,
    private readonly serverOptions: {
      port?: number
      host?: string
      transportType?: 'sse' | 'stdio'
    }
  ) {
    this.serverComposer = new McpServerComposer(serverInfo)
    this.server = this.serverComposer.server
    this.transportType = serverOptions.transportType ?? 'sse'
  }

  private setupRoutes () {
    if (this.transportType === 'stdio') {
      // stdio 模式
      const transport = new StdioServerTransport()
      this.serverComposer.server.connect(transport)
      this.transports['stdio'] = transport
      formatLog('INFO', 'Server initialized in stdio mode')
      return
    }

    this.app = express()
    // SSE 模式
    // Configure CORS
    const corsOptions = {
      origin: '*', // Allow all origins, consider setting specific domains in production
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true, // Allow credentials
      maxAge: 186400 // Preflight request cache time (seconds)
    }

    // 设置请求超时时间为30秒
    this.app.use((req, res, next) => {
      req.setTimeout(240000); // 240秒
      res.setTimeout(240000); // 240秒
      next();
    });

    // Enable CORS
    this.app.use(cors(corsOptions))

    // Support JSON request body parsing
    this.app.use(express.json())

    const transports = {
      streamable: new Map(),
      sse: new Map()
    }

    // 现代化Streamable HTTP端点
    // app.all('/mcp', async (req, res) => {
    //   const transport = new StreamableHTTPServerTransport({
    //     sessionIdGenerator: () => uuidv4(),
    //     onsessioninitialized: (sessionId) => {
    //       console.log(`新会话已初始化: ${sessionId}`);
    //     }
    //   });

    //   if (transport.sessionId) {
    //     transports.streamable.set(transport.sessionId, transport);

    //     res.on("close", () => {
    //       if (transport.sessionId) {
    //         transports.streamable.delete(transport.sessionId);
    //       }
    //     });

    //     await transport.handleRequest(req, res, req.body);
    //     await server.connect(transport);
    //   }
    // });

    // SSE connection endpoint
    this.app.get('/', (_, res) => {
      const transport = new ExpressSSEServerTransport('/sessions')
      this.serverComposer.server.connect(transport)
      transport.onclose = () => {
        formatLog('INFO', `Session ${transport.sessionId} closed`)
        delete this.transports[transport.sessionId]
      }
      this.transports[transport.sessionId] = transport
      formatLog('INFO', `Session ${transport.sessionId} opened`)
      transport.handleSSERequest(res)
    })

    // Message handling endpoint
    this.app.post('/sessions', (req, res) => {
      const sessionId = req.query.sessionId as string
      if (!sessionId || !this.transports[sessionId]) {
        res.status(400).send('Invalid session ID')
        return
      }
      const transport = this.transports[sessionId]
      if (transport instanceof ExpressSSEServerTransport) {
        transport.handlePostMessage(req, res)
      } else {
        res.status(400).send('Invalid transport type')
      }
    })

    // API endpoint
    this.app.get('/api/list-mcp-servers', (_, res) => {
      res.json(this.serverComposer.listTargetClients())
    })

    // 404 handler
    this.app.use((_, res) => {
      res.status(404).send('Not found')
    })

    // Error handling middleware
    this.app.use(
      (err: Error, _, res: express.Response, next: express.NextFunction) => {
        formatLog('ERROR', err.message)
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

  parseToolChains (config: any) {
    const toolChains = config?.toolChains || []
    for (const toolChain of toolChains) {
      this.serverComposer.composeToolChain(toolChain)
    }
  }

  async importMcpConfig (config: any) {
    const targetServers = this.parseConfig(config)

    this.serverComposer.namespace = config.namespace || NAMESPACE_SEPARATOR

    for (const targetServer of targetServers) {
      let config
      if (targetServer.type === 'sse') {
        config = {
          name: targetServer.name,
          type: 'sse',
          url: new URL(targetServer.url),
          params: targetServer.params,
          tools: targetServer.tools
        }
      } else {
        config = {
          name: targetServer.name,
          type: 'stdio',
          params: targetServer.params,
          tools: targetServer.tools
        }
      }
      // console.log(targetServer)
      await this.serverComposer.add(config, {
        name:
          targetServer.name ??
          (targetServer.url
            ? new URL(targetServer.url).hostname
            : 'stdio-server'),
        version: targetServer.version ?? '1.0.0',
        description: targetServer.description ?? ''
      })
    }

    this.parseToolChains(config)

    // tools的开关
    const tools = config?.tools || []

    if (tools.length > 0) {
      //@ts-ignore
      for (const name in this.serverComposer.server._registeredTools) {
        if (!tools.includes(name)) {
          //@ts-ignore
          this.serverComposer.server._registeredTools[name].disable()
        }
      }
      if (Array.isArray(config?.toolChains)) {
        for (const toolChain of config.toolChains) {
          //@ts-ignore
          this.serverComposer.server._registeredTools[toolChain.name].enable()
        }
      }
    }
  }
  start () {
    this.setupRoutes()

    if (this.transportType === 'stdio') {
      formatLog('INFO', 'Server running in stdio mode')
      return
    }

    const port = this.serverOptions.port ?? 3003
    const host = this.serverOptions.host ?? '0.0.0.0'

    this.httpServer = this.app.listen(port, host, () => {
      let mcpConfig = { mcpServers: {} }
      // @ts-ignore
      const serverInfo = this.serverComposer.server.server._serverInfo

      mcpConfig['mcpServers'][serverInfo.name] = {
        url: `http://127.0.0.1:${port}`
      }

      formatLog(
        'INFO',
        `\n\nMCP Server Config: ${JSON.stringify(mcpConfig, null, 2)}\n\n`
      )
      formatLog('INFO', `\n\nMCP Server(sse) running on port ${port}\n\n`)
    })
  }

  /**
   * 关闭服务器及其所有连接
   * @returns Promise<void> 当所有资源都已清理完毕时解决
   */
  async close (): Promise<void> {
    try {
      // 断开所有连接
      this.serverComposer.disconnectAll()

      // 1. 关闭所有活跃的传输连接
      const closePromises = Object.entries(this.transports).map(
        async ([sessionId, transport]) => {
          try {
            formatLog('INFO', `正在关闭会话 ${sessionId}...`)
            if (transport instanceof ExpressSSEServerTransport) {
              // 如果传输有自己的关闭方法，调用它
              if (typeof transport.close === 'function') {
                await transport.close()
              }
              // 调用 onclose 回调（如果存在）
              if (transport.onclose) {
                transport.onclose()
              }
            } else if (transport instanceof StdioServerTransport) {
              // 关闭 stdio 传输
              if (typeof transport.close === 'function') {
                await transport.close()
              }
            }
            delete this.transports[sessionId]
          } catch (error) {
            formatLog('ERROR', `关闭会话 ${sessionId} 时出错: ${error.message}`)
          }
        }
      )

      // 等待所有传输连接关闭
      await Promise.all(closePromises)

      // 2. 关闭 HTTP 服务器（如果在 SSE 模式下）
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close(err => {
            if (err) {
              formatLog('ERROR', `关闭 HTTP 服务器时出错: ${err.message}`)
              reject(err)
            } else {
              formatLog('INFO', '成功关闭 HTTP 服务器')
              this.httpServer = null
              resolve()
            }
          })
        })
      }

      formatLog('INFO', '服务器已完全关闭')
    } catch (error) {
      formatLog('ERROR', `关闭服务器时发生错误: ${error.message}`)
      throw error // 重新抛出错误以通知调用者
    }
  }
}
