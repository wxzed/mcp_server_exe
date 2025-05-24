const WebSocket = require('ws')
const { spawn } = require('child_process')

// Configure logging
const logger = {
  info: msg => console.log(`${new Date().toISOString()} - INFO - ${msg}`),
  error: msg => console.error(`${new Date().toISOString()} - ERROR - ${msg}`),
  warning: msg => console.warn(`${new Date().toISOString()} - WARN - ${msg}`),
  debug: msg => console.debug(`${new Date().toISOString()} - DEBUG - ${msg}`)
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
    let mcpProcess = null

    ws.on('open', () => {
      logger.info('Successfully connected to WebSocket server')

      // Reset reconnection counter if connection closes normally
      reconnectAttempt = 0
      backoff = INITIAL_BACKOFF

      // Start server process using compiled JS
      mcpProcess = spawn('node', [
        'dist/server.js',
        '--mcp-js',
        'examples/test-config.js',
        '--transport',
        'stdio'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      })
      logger.info('Started MCP server using compiled JS')

      // Pipe WebSocket to process
      ws.on('message', data => {
        const message = data.toString('utf-8')
        logger.debug(`<< ${message.slice(0, 120)}...`)
        mcpProcess.stdin.write(message + '\n')
      })

      // Pipe process to WebSocket
      mcpProcess.stdout.on('data', data => {
        const message = data.toString('utf-8')
        logger.debug(`>> ${message.slice(0, 120)}...`)
        ws.send(message)
      })

      // Pipe process stderr to terminal
      mcpProcess.stderr.on('data', data => {
        process.stderr.write(data)
      })

      // Handle process exit
      mcpProcess.on('exit', code => {
        logger.info(`Process exited with code ${code}`)
        ws.close()
      })
    })

    ws.on('close', () => {
      logger.error('WebSocket connection closed')
      if (mcpProcess) {
        logger.info(`Terminating mcp process`)
        mcpProcess.kill()
      }
      reject(new Error('WebSocket connection closed'))
    })

    ws.on('error', error => {
      logger.error(`WebSocket error: ${error}`)
      if (mcpProcess) {
        logger.info(`Terminating mcp process`)
        mcpProcess.kill()
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
