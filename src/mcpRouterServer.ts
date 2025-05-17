import type { Implementation } from '@modelcontextprotocol/sdk/types.js'
import { McpServerComposer } from './serverComposer'
import { ExpressSSEServerTransport } from './expressSseTransport'
import type { McpServerType } from './utils/schemas'
import express from 'express'
import cors from 'cors'
import type { Express } from 'express'
import { formatLog } from './utils/console'

export class McpRouterServer {
  private readonly serverComposer: McpServerComposer
  private readonly transports: Record<string, ExpressSSEServerTransport> = {}
  private readonly app: Express

  constructor (
    serverInfo: Implementation,
    private readonly serverOptions: {
      port?: number
      host?: string
    }
  ) {
    this.serverComposer = new McpServerComposer(serverInfo)
    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes () {
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

    // SSE connection endpoint
    this.app.get('/', (_, res) => {
      const transport = new ExpressSSEServerTransport('/sessions')
      this.serverComposer.server.connect(transport)
      transport.onclose = () => {
        console.log(`Session ${transport.sessionId} closed`)
        delete this.transports[transport.sessionId]
      }
      this.transports[transport.sessionId] = transport
      console.log(`Session ${transport.sessionId} opened`)
      transport.handleSSERequest(res)
    })

    // Message handling endpoint
    this.app.post('/sessions', (req, res) => {
      const sessionId = req.query.sessionId as string
      if (!sessionId || !this.transports[sessionId]) {
        res.status(400).send('Invalid session ID')
        return
      }
      this.transports[sessionId].handlePostMessage(req, res)
    })

    // Health check endpoint
    this.app.get('/health', (_, res) => {
      res.status(200).send('OK')
    })

    // API endpoint
    this.app.get('/api/list-targets', (_, res) => {
      res.json(this.serverComposer.listTargetClients())
    })

    // 404 handler
    this.app.use((_, res) => {
      res.status(404).send('Not found')
    })

    // Error handling middleware
    this.app.use(
      (err: Error, _, res: express.Response, next: express.NextFunction) => {
        console.error(err)
        res.status(500).send('Internal server error')
        next()
      }
    )
  }

  async add (targetServers: McpServerType[]) {
    for (const targetServer of targetServers) {
      await this.serverComposer.add(new URL(targetServer.url), {
        name: targetServer.name ?? new URL(targetServer.url).hostname,
        version: targetServer.version ?? '1.0.0',
        description: targetServer.description ?? ''
      })
    }
  }

  start () {
    const port = this.serverOptions.port ?? 3001
    const host = this.serverOptions.host ?? '0.0.0.0'

    this.app.listen(port, host, () => {
      console.log(`Server running on http://${host}:${port}`)
    })
  }
}
