const fs = require('fs')
const path = require('path')
const { loadServerConfig } = require('./tools/serverConfig.js')
const { McpRouterServer } = require('./mcpRouterServer')
const { WebSocketServer } = require('./webSocketServer')
const { cronjob } = require('./cronjob/index')
import { formatLog } from './utils/console'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

let currentServer: any = null

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
  cronjob?: string // 新增cronjob参数
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

  // cronjob参数
  if (args[i] === '--cronjob' && i + 1 < args.length) {
    cliArgs.cronjob = args[i + 1]
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
    formatLog(
      'INFO',
      `
使用方法: node server.js [选项]

必需参数:
  无

可选参数:
  --ws <url>             WebSocket 服务器地址（如果指定，将使用WebSocket模式）
  --mcp-js <path>        MCP JavaScript 配置文件路径
  --mcp-config <path/json>    MCP JSON 配置文件路径/json字符串
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
    `
    )
    process.exit(0)
  }
}

// 设置 transport 默认值为 sse（如果不是WebSocket模式）
if (!cliArgs.ws && !cliArgs.transport) {
  cliArgs.transport = 'sse'
}

// 合并配置
const config = loadServerConfig({}, cliArgs)

// 加载本地配置
const loadConfig = (config: any) => {
  let mcpJSON: any = {},
    serverInfo: any = {}

  const checkJSON = (str: string) => {
    try {
      let d = JSON.parse(str)
      if (d.mcpServers && Object.keys(d.mcpServers).length > 0) {
        return true
      }
    } catch (error) {
      return false
    }
  }

  try {
    // 1. 重新加载 MCP JSON 配置文件
    if (config?.mcpConfig && fs.existsSync(config.mcpConfig)) {
      const text = fs.readFileSync(config.mcpConfig, 'utf8')
      mcpJSON = JSON.parse(text)
    } else if (config?.mcpConfig && checkJSON(config.mcpConfig)) {
      mcpJSON = JSON.parse(config.mcpConfig)
    } else {
      formatLog(
        'INFO',
        `配置文件 ${config.mcpConfig} 在加载时未找到，将使用空配置。`
      )
      mcpJSON = {}
    }

    // 2. 基于新的 mcpJSON (和原始 config) 更新 serverInfo
    serverInfo = mcpJSON.serverInfo || {
      name: config.serverName,
      version: config.version,
      description: config.description,
      author: config.author,
      license: config.license,
      homepage: config.homepage
    }
  } catch (error) {
    formatLog('ERROR', `加载配置文件失败: ${error.message}`)
  }
  return { mcpJSON, serverInfo }
}

let { mcpJSON, serverInfo } = loadConfig(config)

// 加载配置文件
let configureMcp = null;

const loadCustomConfig = () => {
  if (customConfigPath && fs.existsSync(customConfigPath)) {
    const customConfigFullPath = path.resolve(process.cwd(), customConfigPath)
    formatLog('INFO', `加载配置文件: ${customConfigFullPath}`)

    try {
      // 清除require缓存以确保重新加载最新的文件
      delete require.cache[require.resolve(customConfigFullPath)]
      const customModule = require(customConfigFullPath)

      if (
        customModule.mcpPlugin &&
        typeof customModule.mcpPlugin === 'function'
      ) {
        formatLog('INFO', '发现 mcpPlugin 函数，将用于配置 MCP 服务器')
        configureMcp = customModule.mcpPlugin
        return true
      }

      if (
        customModule.configureMcp &&
        typeof customModule.configureMcp === 'function'
      ) {
        formatLog('INFO', '发现 configureMcp 函数，将用于配置 MCP 服务器')
        configureMcp = customModule.configureMcp
        return true
      }
    } catch (error) {
      formatLog('ERROR', `加载配置文件失败: ${error.message}`)
    }
  }
  return false
}

// 初始加载自定义配置
loadCustomConfig()

async function startServer () {
  // 停止现有的服务器实例（如果存在）
  if (currentServer) {
    formatLog('INFO', '检测到重启请求，正在停止当前服务...')
    try {
      // 尝试调用 close() 方法，这是推荐的异步关闭方法
      if (typeof (currentServer as any).close === 'function') {
        await (currentServer as any).close()
      } else {
        formatLog(
          'INFO',
          '当前服务实例没有可识别的 stop 或 close 方法。可能无法完全停止旧实例。'
        )
      }
      formatLog('INFO', '旧服务实例已处理停止请求。')
    } catch (stopError) {
      formatLog('ERROR', '停止旧服务实例时发生错误:')
      // 即使停止旧服务失败，也应尝试启动新服务
    }
    currentServer = null // 清除对旧服务器实例的引用
  }

  try {
    if (cliArgs.ws) {
      // WebSocket模式
      formatLog(
        'INFO',
        `使用WebSocket模式，连接到: ${cliArgs.ws.slice(0, 20)}...`
      )
      const wsServer = new WebSocketServer(
        cliArgs.ws,
        serverInfo, // 使用更新后的全局 serverInfo
        server => {
          if (typeof configureMcp === 'function') {
            configureMcp(server, ResourceTemplate, z)
          }
        },
        mcpJSON // 使用更新后的全局 mcpJSON
      )
      currentServer = wsServer // 将新实例赋值给 currentServer
      await wsServer.start()
      formatLog('INFO', 'MCP Server Started Successfully')
    } else if (cliArgs.cronjob) {
      // 创建一个mcprouterserver的stdio模式
      const routerServer = new McpRouterServer(serverInfo, {
        port: config.port,
        host: config.host ?? '0.0.0.0',
        transportType: config.transport as 'sse' | 'stdio'
      })
      currentServer = routerServer

      // 导入配置并启动服务器
      await routerServer.importMcpConfig(mcpJSON, configureMcp)
      await routerServer.start()

      cronjob(cliArgs.cronjob, currentServer.getActiveServer()._client)

      formatLog('INFO', 'MCP Server Started Successfully')
    } else {
      // 常规模式
      const routerServer = new McpRouterServer(serverInfo, {
        // 使用更新后的全局 serverInfo
        port: config.port,
        host: config.host ?? '0.0.0.0',
        transportType: config.transport as 'sse' | 'stdio'
      })
      currentServer = routerServer // 将新实例赋值给 currentServer

      await routerServer.importMcpConfig(mcpJSON, configureMcp) // 使用更新后的全局 mcpJSON
      routerServer.start()
      formatLog('INFO', 'MCP Server Started Successfully')
    }
  } catch (error) {
    formatLog('ERROR', '启动服务器时发生错误:' + error)
    currentServer = null // 如果启动失败，确保 currentServer 为空
    throw error
  }
}

// --- 新增：监听配置文件变化并自动重启服务 ---
let debounceTimeout: NodeJS.Timeout | null = null

function debounceRestart (delay: number) {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }
  debounceTimeout = setTimeout(() => {
    formatLog('INFO', '开始重新加载配置并重启服务...')

    try {
      // 重新加载 MCP JSON 配置
      let newConfig = loadConfig(config)
      mcpJSON = newConfig.mcpJSON
      serverInfo = newConfig.serverInfo
      formatLog('INFO', 'ServerInfo 已基于新配置更新。')

      // 重新加载自定义配置文件
      loadCustomConfig()
      formatLog('INFO', '自定义配置已重新加载。')

      // 调用 startServer 以重启服务
      startServer()
    } catch (reloadError) {
      formatLog(
        'ERROR',
        `重新加载配置或重启服务时发生错误: ${reloadError.message}`
      )
      throw reloadError
    }
  }, delay)
}

if (config.mcpConfig && fs.existsSync(config.mcpConfig)) {
  formatLog(
    'INFO',
    `正在监听配置文件: ${config.mcpConfig} 的变化以进行自动重启...`
  )
  fs.watchFile(config.mcpConfig, { interval: 1000 }, (curr, prev) => {
    // fs.watchFile 检查文件的修改时间 (mtime)
    if (curr.mtime !== prev.mtime) {
      formatLog('INFO', `检测到配置文件 ${config.mcpConfig} 已修改。`)
      debounceRestart(2000) // 设置2秒的防抖延迟后重启
    }
  })
} else if (config.mcpConfig) {
  formatLog(
    'INFO',
    `指定的 MCP JSON 配置文件不存在，无法监听其变化。服务将以无 MCP JSON 配置或默认配置启动。`
  )
}

// 监听自定义配置文件（--mcp-js）的变化
if (customConfigPath && fs.existsSync(customConfigPath)) {
  const customConfigFullPath = path.resolve(process.cwd(), customConfigPath)
  formatLog(
    'INFO',
    `正在监听自定义配置文件: ${customConfigFullPath} 的变化以进行自动重启...`
  )
  fs.watchFile(customConfigFullPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      formatLog('INFO', `检测到自定义配置文件 ${customConfigFullPath} 已修改。`)
      debounceRestart(2000)
    }
  })
} else if (customConfigPath) {
  formatLog(
    'INFO',
    `指定的自定义配置文件 ${customConfigPath} 不存在，无法监听其变化。`
  )
}
// --- 文件监听逻辑结束 ---

startServer()
