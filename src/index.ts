import { McpRouterServer } from './mcpRouterServer'
// 1. 首先创建服务器信息
const serverInfo = {
  name: 'MCP Router',
  version: '1.0.0',
  description: 'Model Context Protocol Router Server',
  supportedProtocolVersions: ['1.0.0']
}

// 2. 创建路由服务器实例
const routerServer = new McpRouterServer(serverInfo, {
  port: 3001, // 可选，默认为 3001
  host: '0.0.0.0' // 可选，默认为 "0.0.0.0"
})

// 3. 配置目标服务器

const config = {
  mcpServers: {
    'Model Server 1': {
      url: 'http://127.0.0.1:9090'
    },
    'Model Server - stdio': {
      command:
        'C:/Users/38957/Documents/GitHub/mcp_server.exe/executables/mcp_server-win-x64.exe',
      args: ['--transport', 'stdio']
    }
  }
}

// 4. 加载目标服务器并启动路由服务器
async function startServer () {
  try {
    // 加载所有目标服务器
    await routerServer.importMcpConfig(config)

    // 启动服务器
    routerServer.start()
  } catch (error) {
    console.error('启动服务器时发生错误:', error)
  }
}

startServer()
