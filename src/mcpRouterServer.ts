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

export class McpRouterServer {
  private readonly serverComposer: McpServerComposer
  private readonly transports: Record<
    string,
    ExpressSSEServerTransport | StdioServerTransport
  > = {}
  private app: Express
  private readonly transportType: 'sse' | 'stdio'
  public readonly server: McpServer
  constructor(
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
    this.setupRoutes()
  }

  private setupRoutes() {
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
      maxAge: 86400 // Preflight request cache time (seconds)
    }

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

  parseConfig(config: any) {
    const mcpServers = config?.mcpServers || {};
  
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

  parseToolChains(config: any) {
    const toolChains = config?.toolChains || [];
    for (const toolChain of toolChains) {
      this.serverComposer.composeToolChain(toolChain)
    }
  }

  async importMcpConfig(config: any) {
    const targetServers = this.parseConfig(config)

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
    const tools = config?.tools || [];

    if (tools.length > 0) {
      //@ts-ignore
      for (const name in this.serverComposer.server._registeredTools) {
        if (!tools.includes(name)) {
          //@ts-ignore
          this.serverComposer.server._registeredTools[name].disable()
        }
      }
    }


  }
  start() {
    if (this.transportType === 'stdio') {
      formatLog('INFO', 'Server running in stdio mode')
      return
    }

    const port = this.serverOptions.port ?? 3003
    const host = this.serverOptions.host ?? '0.0.0.0'

    this.app.listen(port, host, () => {
      let mcpConfig = { mcpServers: {} }
      // @ts-ignore
      const serverInfo = this.serverComposer.server.server._serverInfo

      mcpConfig['mcpServers'][serverInfo.name] = {
        url: `http://127.0.0.1:${port}/sse`
      }

      formatLog(
        'INFO',
        `\n\nMCP Server Config: ${JSON.stringify(mcpConfig, null, 2)}\n\n`
      )
      // formatLog('INFO',`\nMCP服务器(streamable)运行在端口 ${port}/mcp`);
      formatLog('INFO', `\n\nMCP Server(sse) running on port ${port}\n\n`)
    })
  }
}
