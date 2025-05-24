# 从 Spawn 模式到直接调用模式的修改

## 概述

本次修改将 `wsMcp.js` 中的子进程 spawn 模式替换为直接调用模式，提高了性能并减少了系统资源消耗。

## 主要修改

### 1. 移除子进程依赖
- 移除了 `const { spawn } = require('child_process')`
- 添加了直接导入 MCP 服务器模块：
  ```javascript
  const { McpRouterServer } = require('./dist/mcpRouterServer')
  const { loadServerConfig } = require('./dist/tools/serverConfig')
  ```

### 2. 创建自定义 WebSocket Transport 类
```javascript
class WebSocketServerTransport {
  constructor(ws) {
    this.ws = ws
    this.onmessage = null
    this.onclose = null
    this.onerror = null
  }

  async start() {
    // Transport 已经在 WebSocket 连接时启动
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
```

### 3. 直接实例化 MCP 服务器
替换了原来的子进程启动方式：
```javascript
// 旧方式 (spawn)
mcpProcess = spawn('node', [
  'dist/server.js',
  '--mcp-js',
  'examples/test-config.js',
  '--transport',
  'stdio'
], {
  stdio: ['pipe', 'pipe', 'pipe']
})

// 新方式 (直接调用)
const routerServer = new McpRouterServer(serverInfo, {
  port: config.port,
  host: config.host ?? '0.0.0.0',
  transportType: 'stdio'
})
```

### 4. 直接配置工具和资源
```javascript
// 配置 MCP 服务器的工具、资源和提示
if (typeof configureMcp === 'function') {
  const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
  const { z } = require('zod')
  configureMcp(routerServer.server, ResourceTemplate, z)
}
```

### 5. 自定义消息处理
替换了管道通信：
```javascript
// 旧方式 (管道)
ws.on('message', data => {
  const message = data.toString('utf-8')
  mcpProcess.stdin.write(message + '\n')
})

mcpProcess.stdout.on('data', data => {
  const message = data.toString('utf-8')
  ws.send(message)
})

// 新方式 (直接调用)
ws.on('message', data => {
  try {
    const message = data.toString('utf-8')
    const jsonMessage = JSON.parse(message)
    if (transport.onmessage) {
      transport.onmessage(jsonMessage)
    }
  } catch (error) {
    logger.error(`Error processing message: ${error.message}`)
  }
})
```

## 优势

1. **性能提升**: 消除了子进程创建和管道通信的开销
2. **资源节约**: 减少了内存和 CPU 使用
3. **错误处理**: 更好的错误处理和调试能力
4. **代码简化**: 减少了进程间通信的复杂性
5. **启动速度**: 更快的服务器启动时间

## 测试验证

创建了测试脚本验证直接调用功能：
- 成功加载配置文件
- 正确注册工具 (test-echo, get-current-time, math-add)
- 验证 ResourceTemplate 和 zod 可用性

## 兼容性

修改保持了与原有 API 的完全兼容性，只是改变了内部实现方式。所有现有的配置文件和使用方式都无需修改。 