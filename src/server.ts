const fs = require('fs')
const path = require('path')
const { loadServerConfig } = require('./tools/serverConfig.js')
const { McpRouterServer } = require('./mcpRouterServer')
const { WebSocketServer } = require('./webSocketServer')

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

// 解析命令行参数
const args = process.argv.slice(2)
let customConfigPath = null

// 定义 cliArgs 接口
interface CliArgs {
  serverName?: string
  host?: string
  port?: string
  version?: string
  description?: string
  author?: string
  license?: string
  homepage?: string
  transport?: string
  mcpConfig?: string
  ws?: string // 新增WebSocket URL参数
}

// 创建 cliArgs 对象
let cliArgs: CliArgs = {}

// 处理命令行参数
for (let i = 0; i < args.length; i++) {
  // WebSocket URL参数
  if (args[i] === '--ws' && i + 1 < args.length) {
    cliArgs.ws = args[i + 1]
    i++
    continue
  }

  // 只使用 --mcp-js 参数
  if (args[i] === '--mcp-js' && i + 1 < args.length) {
    customConfigPath = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--server-name' && i + 1 < args.length) {
    cliArgs.serverName = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--port' && i + 1 < args.length) {
    cliArgs.port = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--version' && i + 1 < args.length) {
    cliArgs.version = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--description' && i + 1 < args.length) {
    cliArgs.description = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--author' && i + 1 < args.length) {
    cliArgs.author = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--license' && i + 1 < args.length) {
    cliArgs.license = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--homepage' && i + 1 < args.length) {
    cliArgs.homepage = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--transport' && i + 1 < args.length) {
    cliArgs.transport = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--mcp-config' && i + 1 < args.length) {
    cliArgs.mcpConfig = args[i + 1]
    i++
    continue
  }
  if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
使用方法: node server.js [选项]

必需参数:
  无

可选参数:
  --ws <url>             WebSocket 服务器地址（如果指定，将使用WebSocket模式）
  --mcp-js <path>        MCP JavaScript 配置文件路径
  --mcp-config <path>    MCP JSON 配置文件路径
  --server-name <name>   服务器名称
  --port <port>          端口号
  --version <version>    版本号
  --description <desc>   描述
  --author <author>      作者
  --license <license>    许可证
  --homepage <url>       主页
  --transport <type>     传输类型 (sse/stdio)
  --help, -h            显示此帮助信息

示例:
  node server.js --ws ws://localhost:8080
  node server.js --port 3000 --transport sse
    `)
    process.exit(0)
  }
}

// 设置 transport 默认值为 sse（如果不是WebSocket模式）
if (!cliArgs.ws && !cliArgs.transport) {
  cliArgs.transport = 'sse'
}

// 合并配置
const config = loadServerConfig({}, cliArgs)

let mcpJSON: any = {}
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

// 加载配置文件
let configureMcp = null

if (customConfigPath && fs.existsSync(customConfigPath)) {
  const customConfigFullPath = path.resolve(process.cwd(), customConfigPath)
  console.log(`加载配置文件: ${customConfigFullPath}`)

  try {
    const customModule = require(customConfigFullPath)

    if (
      customModule.configureMcp &&
      typeof customModule.configureMcp === 'function'
    ) {
      console.log('发现 configureMcp 函数，将用于配置 MCP 服务器')
      configureMcp = customModule.configureMcp
    }
  } catch (error) {
    console.error(`加载配置文件失败: ${error.message}`)
  }
}

async function startServer () {
  try {
    if (cliArgs.ws) {
      // WebSocket模式
      console.log(`使用WebSocket模式，连接到: ${cliArgs.ws}`)
      const wsServer = new WebSocketServer(
        cliArgs.ws,
        serverInfo,
        server => {
          if (typeof configureMcp === 'function') {
            configureMcp(server, ResourceTemplate, z)
          }
        },
        mcpJSON
      )
      await wsServer.start()
    } else {
      // 常规模式
      const routerServer = new McpRouterServer(serverInfo, {
        port: config.port,
        host: config.host ?? '0.0.0.0',
        transportType: config.transport as 'sse' | 'stdio'
      })

      if (typeof configureMcp === 'function') {
        configureMcp(routerServer.server, ResourceTemplate, z)
      }

      await routerServer.importMcpConfig(mcpJSON)
      routerServer.start()
    }
  } catch (error) {
    console.error('启动服务器时发生错误:', error)
  }
}

startServer()
