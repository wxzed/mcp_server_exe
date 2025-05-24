const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { z } = require('zod')
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
  constructor (ws) {
    this.ws = ws
    this.onmessage = null
    this.onclose = null
    this.onerror = null
  }

  async start () {
    // Transport is already started when WebSocket connection is established
  }

  async send (message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      logger.debug(`>> ${JSON.stringify(message)}`)
      this.ws.send(JSON.stringify(message))
    }
  }

  async close () {
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

// 添加全局变量来存储命令行参数
let globalCliArgs = null
let globalCustomConfigPath = null

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

        // Use command line arguments instead of hardcoded values
        const customConfigPath = globalCustomConfigPath
        let cliArgs = globalCliArgs || {
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
          const customConfigFullPath = path.resolve(
            process.cwd(),
            customConfigPath
          )
          logger.info(`Loading config file: ${customConfigFullPath}`)

          try {
            const customModule = require(customConfigFullPath)

            if (
              customModule.configureMcp &&
              typeof customModule.configureMcp === 'function'
            ) {
              logger.info(
                'Found configureMcp function, will use it to configure MCP server'
              )
              configureMcp = customModule.configureMcp
            }
          } catch (error) {
            logger.error(`Failed to load config file: ${error.message}`)
          }
        }

        // Create router server instance, using stdio mode but not starting the actual stdio transport
        routerServer = new McpRouterServer(serverInfo, {})

        // Configure MCP server's tools, resources, and prompts
        if (typeof configureMcp === 'function') {
          configureMcp(routerServer.server, ResourceTemplate, z)
        }

        // 1. 首先创建WebSocket传输层
        const transport = new WebSocketServerTransport(ws)

        // 2. 连接MCP服务器到传输层
        await routerServer.server.connect(transport)

        // 3. 最后导入MCP配置
        routerServer.importMcpConfig(mcpJSON)

        // Set message processing
        ws.on('message', data => {
          try {
            const message = data.toString('utf-8')
            logger.debug(`<< ${message.slice(0, 220)}...`)

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
  // Parse command line arguments - 参考 server.ts 的设计
  const args = process.argv.slice(2)
  let websocketUrl = null
  let customConfigPath = null

  // 定义 cliArgs 对象
  let cliArgs = {}

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    // WebSocket URL 参数
    if (args[i] === '--ws' && i + 1 < args.length) {
      websocketUrl = args[i + 1]
      i++
      continue
    }

    // MCP JavaScript 配置文件路径
    if (args[i] === '--mcp-js' && i + 1 < args.length) {
      customConfigPath = args[i + 1]
      i++
      continue
    }

    if (args[i] === '--mcp-config' && i + 1 < args.length) {
      cliArgs.mcpConfig = args[i + 1]
      i++
      continue
    }

    // 帮助信息
    if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
使用方法: node wsMcp.js [选项]

必需参数:
  -ws <url>              WebSocket 服务器地址

可选参数:
  --mcp-js <path>        MCP JavaScript 配置文件路径
  --mcp-config <path>    MCP JSON 配置文件路径
  --help, -h             显示此帮助信息

示例:
  node wsMcp.js -ws ws://localhost:8080 --mcp-js examples/test-config.js
  node wsMcp.js -ws ws://localhost:8080 --mcp-config examples/test-config.json
      `)
      process.exit(0)
    }
  }

  if (!customConfigPath) {
    customConfigPath = 'examples/test-config.js'
    logger.info(
      '未指定 --mcp-js 参数，使用默认配置文件路径: examples/test-config.js'
    )
  }

  // 存储到全局变量供 connectToServer 使用
  globalCliArgs = cliArgs
  globalCustomConfigPath = customConfigPath

  // Get WebSocket URL from arguments
  const endpointUrl = websocketUrl
  if (!endpointUrl) {
    logger.error('错误: 缺少 WebSocket URL 参数')
    logger.error('使用方法: node wsMcp.js -ws <websocket_url> [其他选项]')
    logger.error('使用 --help 查看完整帮助信息')
    process.exit(1)
  }

  logger.info(`使用 WebSocket URL: ${endpointUrl}`)
  if (customConfigPath) {
    logger.info(`使用配置文件: ${customConfigPath}`)
  }

  // Start main loop
  connectWithRetry(endpointUrl).catch(error => {
    logger.error(`Program execution error: ${error}`)
    process.exit(1)
  })
}
