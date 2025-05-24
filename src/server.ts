const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')

const { z } = require('zod')

const fs = require('fs')
const path = require('path')
const { loadServerConfig } = require('./tools/serverConfig.js')
import { McpRouterServer } from './mcpRouterServer'
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
}

// 创建 cliArgs 对象
let cliArgs: CliArgs = {}

// 处理命令行参数
for (let i = 0; i < args.length; i++) {
  // 只使用 --mcp-js 参数
  if (args[i] === '--mcp-js' && i + 1 < args.length) {
    customConfigPath = args[i + 1]
    i++ // 跳过下一个参数，因为它是配置文件路径
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
}

// 设置 transport 默认值为 sse
if (!cliArgs.transport) {
  cliArgs.transport = 'sse'
}

// 合并配置
const config = loadServerConfig({}, cliArgs)

let mcpJSON:any = {}
try {
  if (config?.mcpConfig && fs.existsSync(config.mcpConfig)) {
    let text = fs.readFileSync(config.mcpConfig, 'utf8')
    mcpJSON = JSON.parse(text)
  }
} catch (error) {
  mcpJSON = {}
}

// console.log(config)
const serverInfo =mcpJSON.serverInfo|| {
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
 
    // 检查并加载 configureMcp 函数
    if (
      customModule.configureMcp &&
      typeof customModule.configureMcp === 'function'
    ) {
      // 如果存在 configureMcp 函数，则使用它配置 MCP 服务器
      console.log('发现 configureMcp 函数，将用于配置 MCP 服务器')
      configureMcp = customModule.configureMcp
    }
  } catch (error) {
    console.error(`加载配置文件失败: ${error.message}`)
  }
}


// 2. 创建路由服务器实例
const routerServer = new McpRouterServer(serverInfo, {
  port: config.port,
  host: config.host ?? '0.0.0.0',
  transportType: config.transport as 'sse' | 'stdio'
})

// 配置MCP服务器的工具、资源和提示
if (typeof configureMcp === 'function') {
  configureMcp(routerServer.server, ResourceTemplate, z)
}

async function startServer () {
  try {
    // 加载所有目标服务器
    await routerServer.importMcpConfig(mcpJSON)
    // 启动服务器
    routerServer.start()
  } catch (error) {
    console.error('启动服务器时发生错误:', error)
  }
}

startServer()
