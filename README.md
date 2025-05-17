![MCP EXE](./assets/image.png)

# MCP Server.exe

把 MCP (Model Context Protocol) 服务器制作成可执行文件，支持现代和传统客户端连接。

Turn MCP (Model Context Protocol) server into an executable file, supporting both modern and legacy client connections.

```
+-----------------------------------+
|                                   |
|     Node.js MCP Server Code       |
|                                   |
+----------------+------------------+
                 |
                 v
+----------------+------------------+
|                                   |
|     PKG Packaging Process         |
|                                   |
+----------------+------------------+
                 |
                 v
+----------------+------------------+
|   MCP_SERVER.EXE                  |
|   +------------------------+      |
|   |                        |      |
|   |  MCP Server Core Logic |      |
|   |                        |      |
|   +------------------------+      |
|             ^                     |
|             |                     |
|   +------------------------+      |
|   |                        |      |
|   | --mcp-js Parameter     |      |
|   | Custom Config Loader   |      |
|   |                        |      |
|   +------------------------+      |
|             ^                     |
|             |                     |
|   +------------------------+      |
|   |                        |      |
|   | --mcp-config Parameter |      |
|   | Combined MCP Services  |      |
|   |                        |      |
|   +------------------------+      |
|                                   |
+-----------------------------------+
           |           |
           v           v
+----------------+ +----------------+
|  Transport     | |  Transport     |
|  Mode: SSE     | |  Mode: stdio   |
+----------------+ +----------------+
```


## 功能特性 | Features

- 支持现代 Streamable HTTP 端点 (/mcp)
- 支持传统 SSE 端点 (/sse) 和消息端点 (/messages)
- 可自定义配置工具、资源和提示
- 支持组合多个 MCP 服务
- 支持 SSE 和 stdio 两种传输模式

- Supports modern Streamable HTTP endpoint (/mcp)
- Supports legacy SSE endpoint (/sse) and message endpoint (/messages)
- Customizable configuration for tools, resources, and prompts
- Support for combining multiple MCP services
- Support for both SSE and stdio transport modes

## 安装 | Installation

```bash
npm install
```

## 构建 | Build

```bash
npm run build
```

## 运行 | Run

```bash
npm start
```

或者开发模式 | Or development mode:

```bash
npm run dev
```

## 命令行参数 | Command Line Arguments

服务器支持以下命令行参数来自定义其行为：

The server supports the following command line arguments to customize its behavior:

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--mcp-js <路径>` | 配置文件路径（包含服务器配置和 MCP 配置） | 内置配置 |
| `--port <端口>` | 服务器监听端口 | 3000 |
| `--mcp-config <路径>` | MCP 配置文件路径，用于组合多个 MCP 服务 | 无 |
| `--transport <模式>` | 传输模式，支持 'sse' 或 'stdio' | sse |

使用示例：

Example usage:

```bash
# 使用自定义名称和端口运行服务器
# Run server with custom name and port
node dist/server.js --server-name my-mcp-server --port 8080

# 使用配置文件运行（同时配置服务器和 MCP）
# Run server with configuration file (both server and MCP config)
node dist/server.js --mcp-js ./examples/custom-mcp-config.js

# 使用 MCP 配置文件组合多个服务
# Combine multiple MCP services using config file
node dist/server.js --mcp-config ./examples/mcp-services.json

# 使用 stdio 传输模式运行
# Run server with stdio transport mode
node dist/server.js --transport stdio

# 使用完整命令行参数运行服务器
# Run server with full command line arguments
node dist/server.js --server-name custom-server --port 8080 --version 2.0.0 --description "My Custom MCP Server" --author "Your Name" --license "Apache-2.0" --homepage "https://example.com/mcp-server" --transport stdio --mcp-config ./examples/mcp-services.json

# 使用可执行文件和配置文件
# Run executable with configuration file
./executables/mcp_server --mcp-js ./examples/custom-mcp-config.js --mcp-config ./examples/mcp-services.json
```

## 综合配置文件 | Unified Configuration File

服务器支持使用配置文件同时配置服务器参数和 MCP 功能。配置文件可以导出以下内容：

The server supports using a configuration file to configure both server parameters and MCP functionality. The configuration file can export the following:

1. **基本配置对象** - 作为服务器基本配置
2. **configureServer 函数** - 动态生成服务器配置（优先于基本配置对象）
3. **configureMcp 函数** - 配置 MCP 服务器的资源、工具和提示

命令行参数的优先级高于配置文件中的设置。

Command line arguments have higher priority than settings in the configuration file.

### 配置文件格式 | Configuration File Format

```javascript
/**
 * MCP 服务器综合配置文件
 */
module.exports = {
  // 服务器基本配置（静态）
  serverName: "custom-mcp-server",
  port: 8080,
  version: "1.1.0",
  description: "自定义 MCP 服务器",
  author: "yourname",
  license: "MIT",
  homepage: "https://example.com/mcp-server",
  
  // 动态服务器配置函数（可选，优先于静态配置）
  configureServer: function() {
    // 返回服务器配置对象
    return {
      serverName: "dynamic-server",
      // 其他配置...
    };
  },
  
  // MCP 配置函数
  configureMcp: function(server, ResourceTemplate, z) {
    // 配置资源
    server.resource(/* ... */);
    
    // 配置工具
    server.tool(/* ... */);
    
    // 配置提示
    server.prompt(/* ... */);
  }
};
```

示例配置文件可参考 `examples/custom-mcp-config.js`。

Refer to `examples/custom-mcp-config.js` for a sample configuration file.

## MCP 自定义配置 | MCP Custom Configuration

服务器支持通过命令行参数 `--mcp-js` 加载自定义MCP工具配置文件：

The server supports loading custom MCP tools configuration files via the command line parameter `--mcp-js`:

```bash
# 使用开发模式加载自定义配置 | Using development mode with custom config
node src/server.ts --mcp-js ./examples/custom-mcp-config.js

# 使用构建后的程序加载自定义配置 | Using built program with custom config
node dist/server.js --mcp-js ./examples/custom-mcp-config.js

# 直接使用打包后的可执行文件加载自定义配置 | Using packaged executable with custom config
./executables/mcp_server --mcp-js ./examples/custom-mcp-config.js
```

### 自定义配置文件格式 | Custom Configuration File Format

自定义配置文件应导出 `configureMcp` 函数，该函数接收三个参数：
- `server`: MCP 服务器实例
- `ResourceTemplate`: 用于定义资源模板的类
- `z`: Zod 验证库实例

The custom configuration file should export a `configureMcp` function that accepts three parameters:
- `server`: MCP server instance
- `ResourceTemplate`: Class for defining resource templates
- `z`: Zod validation library instance

示例配置文件可参考 `examples/custom-mcp-config.js`。

Refer to `examples/custom-mcp-config.js` for a sample configuration file.

## 打包 | Packaging

为 macOS 打包 | Package for macOS:

```bash
npm run package-mac
```

为 Windows 打包 | Package for Windows:

```bash
npm run package-win
```

打包后的可执行文件将生成在 `executables` 目录中。

The packaged executable files will be generated in the `executables` directory.

## API 端点 | API Endpoints

- `/mcp`: 现代 Streamable HTTP 端点 | Modern Streamable HTTP endpoint
- `/sse`: 传统 SSE 端点 | Legacy SSE endpoint
- `/messages`: 传统消息端点 | Legacy message endpoint

## 许可证 | License

ISC
## 环境变量 | Environment Variables

- `PORT` - 服务器端口号（默认：3000）| Server port (default: 3000)
