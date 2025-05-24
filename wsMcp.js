const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')

// Import MCP server related modules
const { McpRouterServer } = require('./dist/mcpRouterServer')
const { loadServerConfig } = require('./dist/tools/serverConfig')

// Configure logging
const logger = {
  info: msg => console.log(`${new Date().toISOString()} - INFO - ${msg}`),
  error: msg => console.error(`${new Date().toISOString()} - ERROR - ${msg}`),
  warning: msg => console.warn(`${new Date().toISOString()} - WARN - ${msg}`),
  debug: msg => console.debug(`${new Date().toISOString()} - DEBUG - ${msg}`)
}

// Create custom WebSocket transport class
class WebSocketServerTransport {
  constructor(ws) {
    this.ws = ws
    this.onmessage = null
    this.onclose = null
    this.onerror = null
  }

  async start() {
    // Transport is already started when WebSocket connection is established
  }

  async send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  async close() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }
}

// Reconnection settings
const INITIAL_BACKOFF = 1000 // Initial wait time in milliseconds
const MAX_BACKOFF = 600000 // Maximum wait time in milliseconds
let reconnectAttempt = 0
let backoff = INITIAL_BACKOFF

async function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function connectWithRetry (uri) {
  while (true) {
    // Infinite reconnection
    try {
      if (reconnectAttempt > 0) {
        const waitTime = backoff * (1 + Math.random() * 0.1) // Add some random jitter
        logger.info(
          `Waiting ${(waitTime / 1000).toFixed(
            2
          )} seconds before reconnection attempt ${reconnectAttempt}...`
        )
        await sleep(waitTime)
      }

      await connectToServer(uri)
    } catch (e) {
      reconnectAttempt++
      logger.warning(`Connection closed (attempt: ${reconnectAttempt}): ${e}`)
      // Calculate wait time for next reconnection (exponential backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF)
    }
  }
}

async function connectToServer (uri) {
  return new Promise((resolve, reject) => {
    logger.info('Connecting to WebSocket server...')
    const ws = new WebSocket(uri)
    let routerServer = null

    ws.on('open', async () => {
      logger.info('Successfully connected to WebSocket server')

      // Reset reconnection counter if connection closes normally
      reconnectAttempt = 0
      backoff = INITIAL_BACKOFF

      try {
        // Create MCP server instance instead of starting a subprocess
        logger.info('Starting MCP server using direct call...')
        
        // Simulate command line argument processing
        const customConfigPath = 'examples/test-config.js'
        let cliArgs = {
          transport: 'stdio'
        }

        // Load configuration
        const config = loadServerConfig({}, cliArgs)
        
        let mcpJSON = {}
        try {
          if (config?.mcpConfig && fs.existsSync(config.mcpConfig)) {
            let text = fs.readFileSync(config.mcpConfig, 'utf8')
            mcpJSON = JSON.parse(text)
          }
        } catch (error) {
          mcpJSON = {}
        }

        const serverInfo = mcpJSON.serverInfo || {
          name: config.serverName,
          version: config.version,
          description: config.description,
          author: config.author,
          license: config.license,
          homepage: config.homepage
        }

        // Load configuration file
        let configureMcp = null
        if (customConfigPath && fs.existsSync(customConfigPath)) {
          const customConfigFullPath = path.resolve(process.cwd(), customConfigPath)
          logger.info(`Loading config file: ${customConfigFullPath}`)

          try {
            const customModule = require(customConfigFullPath)
            
            if (customModule.configureMcp && typeof customModule.configureMcp === 'function') {
              logger.info('Found configureMcp function, will use it to configure MCP server')
              configureMcp = customModule.configureMcp
            }
          } catch (error) {
            logger.error(`Failed to load config file: ${error.message}`)
          }
        }

        // Create router server instance, using stdio mode but not starting the actual stdio transport
        routerServer = new McpRouterServer(serverInfo, {
          port: config.port,
          host: config.host ?? '0.0.0.0',
          transportType: 'stdio'
        })

        // Configure MCP server's tools, resources, and prompts
        if (typeof configureMcp === 'function') {
          const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
          const { z } = require('zod')
          configureMcp(routerServer.server, ResourceTemplate, z)
        }

        // Load all target servers
        await routerServer.importMcpConfig(mcpJSON)

        // Create custom WebSocket transport
        const transport = new WebSocketServerTransport(ws)
        
        // Connect MCP server to custom transport
        await routerServer.server.connect(transport)

        // Set message processing
        ws.on('message', data => {
          try {
            const message = data.toString('utf-8')
            logger.debug(`<< ${message.slice(0, 120)}...`)
            
            // Parse JSON message and pass it to MCP server
            const jsonMessage = JSON.parse(message)
            if (transport.onmessage) {
              transport.onmessage(jsonMessage)
            }
          } catch (error) {
            logger.error(`Error processing message: ${error.message}`)
          }
        })

        logger.info('MCP server started successfully with direct call')

      } catch (error) {
        logger.error(`Failed to start MCP server: ${error.message}`)
        ws.close()
        return
      }
    })

    ws.on('close', () => {
      logger.error('WebSocket connection closed')
      if (routerServer) {
        logger.info(`Cleaning up MCP server`)
        // Here you can add cleanup logic
      }
      reject(new Error('WebSocket connection closed'))
    })

    ws.on('error', error => {
      logger.error(`WebSocket error: ${error}`)
      if (routerServer) {
        logger.info(`Cleaning up MCP server`)
        // Here you can add cleanup logic
      }
      reject(error)
    })
  })
}

// Handle interrupt signals
process.on('SIGINT', () => {
  logger.info('Received interrupt signal, shutting down...')
  process.exit(0)
})

// Main execution
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2) // Remove node and script name
  let websocketUrl = null

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-ws' && i + 1 < args.length) {
      websocketUrl = args[i + 1]
      i++ // Skip next argument as it's the URL
    }
  }

  // Get WebSocket URL from arguments
  const endpointUrl = websocketUrl
  if (!endpointUrl) {
    logger.error('Usage: node ws.js -ws <websocket_url>')
    process.exit(1)
  }

  logger.info(`Using WebSocket URL: ${endpointUrl}`)

  // Start main loop
  connectWithRetry(endpointUrl).catch(error => {
    logger.error(`Program execution error: ${error}`)
    process.exit(1)
  })
}
