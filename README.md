![MCP EXE](./assets/image.png)

# MCP Server.exe
> Cursor 的 MCP 启动器 - MCP For Cursor

把 MCP (Model Context Protocol) 服务器制作成可执行文件，支持多种使用场景的部署和集成。

Turn MCP (Model Context Protocol) server into an executable file, supporting various deployment and integration scenarios.

## 🎯 主要使用场景 | Main Usage Scenarios

### 1. 快速启动独立服务 | Quick Start Standalone Service

最简单的使用方式 - 双击运行，即可启动一个标准的 MCP 服务。

The simplest way - double-click to run, and start a standard MCP service.

```bash
# 双击运行 mcp_server.exe，或通过命令行启动
# Double-click mcp_server.exe, or start via command line:
./mcp_server.exe
```

默认配置 | Default Configuration:
- 监听端口 | Listen Port: 3000
- 支持标准端点 | Standard Endpoints: /mcp, /sse, /messages
- 内置基础工具集 | Built-in Basic Tools

### 2. 组合多个 MCP 服务 | Combine Multiple MCP Services

使用和 **Cursor** 一致的 **mcp.json** 配置文件，通过配置文件组合多个 MCP 服务，支持同时使用 SSE 和 stdio 两种传输模式。这样可以根据不同的应用场景选择合适的传输方式，提高系统的灵活性和可扩展性。

Use the same **mcp.json** configuration file as **Cursor** to combine multiple MCP services, supporting both SSE and stdio transport modes simultaneously. This allows you to choose the appropriate transport method for different application scenarios, improving system flexibility and scalability.

```bash
./mcp_server.exe --mcp-config ./examples/mcp.json
```

配置示例 | Configuration Example (mcp.json):
```json
{
    "mcpServers": {
      "Model Server - sse": {
        "url": "http://127.0.0.1:9090"
      },
      "Model Server - stdio": {
        "command":
          "xxx",
        "args": ["--transport", "stdio"]
      }
    }
}
```

### 3. 自定义工具的插件机制 | Custom Tools Plugin Mechanism

通过 JavaScript 配置文件，灵活定义工具、资源和提示。

Flexibly define tools, resources, and prompts through JavaScript configuration files.

```bash
./mcp_server.exe --mcp-js ./my-custom-tools.js
```

配置示例 | Configuration Example (my-custom-tools.js):
```javascript
module.exports = {
  configureMcp: function(server, ResourceTemplate, z) {
    // 添加自定义工具 | Add custom tool
    server.tool({
      name: "myTool",
      description: "自定义工具示例 | Custom tool example",
      parameters: {
        // ... 参数定义 | Parameter definitions
      }
    });
    
    // 添加自定义资源 | Add custom resource
    server.resource(/* ... */);
  }
}
```

### 4. 嵌入式集成 | Embedded Integration

作为独立进程集成到任何应用程序中。

Integrate as a standalone process into any application.

```javascript
// Node.js 示例 | Node.js Example
const { spawn } = require('child_process');

const mcpServer = spawn('./mcp_server.exe', [
  '--port', '3000',
  '--transport', 'stdio'  // 使用 stdio 模式进行进程间通信 | Use stdio mode for IPC
]);

// 处理输入输出 | Handle I/O
mcpServer.stdout.on('data', (data) => {
  // 处理 MCP 服务器的输出 | Handle MCP server output
});

mcpServer.stdin.write(JSON.stringify({
  // 发送请求到 MCP 服务器 | Send request to MCP server
}));
```

## 📚 详细文档 | Detailed Documentation

### 命令行参数 | Command Line Arguments

服务器支持以下命令行参数来自定义其行为：

The server supports the following command line arguments to customize its behavior:

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--mcp-js <路径>` | 配置文件路径（包含服务器配置和 MCP 配置） | 内置配置 |
| `--port <端口>` | 服务器监听端口 | 3000 |
| `--mcp-config <路径>` | MCP 配置文件路径，用于组合多个 MCP 服务 | 无 |
| `--transport <模式>` | 传输模式，支持 'sse' 或 'stdio' | sse |

### 配置文件格式 | Configuration File Format

服务器支持使用配置文件同时配置服务器参数和 MCP 功能：

The server supports using a configuration file to configure both server parameters and MCP functionality:

```javascript
module.exports = {
  // 服务器基本配置 | Server basic configuration
  serverName: "custom-mcp-server",
  port: 8080,
  
  // 动态服务器配置函数 | Dynamic server configuration function
  configureServer: function() {
    return {
      serverName: "dynamic-server",
      // 其他配置 | Other configurations
    };
  },
  
  // MCP 配置函数 | MCP configuration function
  configureMcp: function(server, ResourceTemplate, z) {
    // 配置资源和工具 | Configure resources and tools
  }
};
```

### 开发指南 | Development Guide

#### 安装 | Installation
```bash
npm install
```

#### 构建 | Build
```bash
npm run build
```

#### 运行 | Run
```bash
npm start
# 或开发模式 | Or development mode
npm run dev
```

#### 打包 | Packaging
```bash
# 为 Windows 打包 | Package for Windows
npm run package-win

# 为 macOS 打包 | Package for macOS
npm run package-mac
```

打包后的可执行文件将生成在 `executables` 目录中。

The packaged executable files will be generated in the `executables` directory.

### 环境变量 | Environment Variables

- `PORT` - 服务器端口号（默认：3000）| Server port (default: 3000)

## 📝 许可证 | License

MIT
