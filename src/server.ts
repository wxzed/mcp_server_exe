const express = require('express')
const {
  McpServer,
  ResourceTemplate
} = require('@modelcontextprotocol/sdk/server/mcp.js')
const {
  StreamableHTTPServerTransport
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const {
  SSEServerTransport
} = require('@modelcontextprotocol/sdk/server/sse.js')
const {
  StdioServerTransport
} = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { v4: uuidv4 } = require('uuid')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const {
  defaultConfig,
  loadServerConfig,
  defaultConfigureMcp
} = require('./tools/serverConfig.js')
import { McpRouterServer } from './mcpRouterServer'
// 解析命令行参数
const args = process.argv.slice(2)
let customConfigPath = null

// 定义 cliArgs 接口
interface CliArgs {
  serverName?: string
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

// 加载配置文件
let customConfig = {}
let configureMcp = null

if (customConfigPath && fs.existsSync(customConfigPath)) {
  const customConfigFullPath = path.resolve(process.cwd(), customConfigPath)
  console.log(`加载配置文件: ${customConfigFullPath}`)

  try {
    const customModule = require(customConfigFullPath)

    // 加载服务器配置
    if (typeof customModule === 'object') {
      // 如果导出的是一个对象，直接作为服务器配置
      customConfig = customModule
    }

    // 检查并加载 configureServer 函数
    if (
      customModule.configureServer &&
      typeof customModule.configureServer === 'function'
    ) {
      // 如果存在 configureServer 函数，则调用它获取服务器配置
      console.log('发现 configureServer 函数，使用其返回值作为服务器配置')
      const serverConfig = customModule.configureServer()
      if (serverConfig && typeof serverConfig === 'object') {
        customConfig = serverConfig
      }
    }

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

// 如果没有找到 configureMcp 函数，则使用默认的
if (!configureMcp) {
  console.log('使用默认 MCP 配置')
  configureMcp = require('./tools/mcpConfig.js').configureMcp
}
console.log(customConfig, cliArgs)
// 合并配置
const config = loadServerConfig(customConfig, cliArgs)
console.log(config)
const serverInfo = {
  name: config.serverName,
  version: config.version,
  description: config.description,
  author: config.author,
  license: config.license,
  homepage: config.homepage
}

// 2. 创建路由服务器实例
const routerServer = new McpRouterServer(serverInfo, {
  port: config.port, // 可选，默认为 3001
  host: '0.0.0.0', // 可选，默认为 "0.0.0.0"
  transportType: config.transport as 'sse' | 'stdio'
})

// 配置MCP服务器的工具、资源和提示
configureMcp(routerServer.server, ResourceTemplate, z)

async function startServer () {
  try {
    const mcpJSON = fs.readFileSync(config.mcpConfig, 'utf8')
    // 加载所有目标服务器
    await routerServer.importMcpConfig(JSON.parse(mcpJSON))
    // console.log(routerServer.server)
    // 启动服务器
    routerServer.start()
  } catch (error) {
    console.error('启动服务器时发生错误:', error)
  }
}

startServer()
