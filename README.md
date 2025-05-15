# MCP Server.exe

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
|                                   |
+-----------------------------------+
           |           |
           v           v
+----------------+ +----------------+
| Modern Clients | | Legacy Clients |
| /mcp Endpoint  | | /sse Endpoint  |
|                | | /messages EP   |
+----------------+ +----------------+
```

把 MCP (Model Context Protocol) 服务器制作成可执行文件，支持现代和传统客户端连接。

Turn MCP (Model Context Protocol) server into an executable file, supporting both modern and legacy client connections.

## 功能特性 | Features

- 支持现代 Streamable HTTP 端点 (/mcp)
- 支持传统 SSE 端点 (/sse) 和消息端点 (/messages)
- 可自定义配置工具、资源和提示

- Supports modern Streamable HTTP endpoint (/mcp)
- Supports legacy SSE endpoint (/sse) and message endpoint (/messages)
- Customizable configuration for tools, resources, and prompts

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
| `--mcp-js <路径>` | 自定义MCP配置文件路径 | 内置配置 |
| `--server-name <名称>` | MCP服务器名称 | mcp_server_exe |
| `--port <端口>` | 服务器监听端口 | 3000 |
| `--version <版本号>` | 服务器版本号 | 1.0.0 |
| `--description <描述>` | 服务器描述信息 | MCP Server for Model Context Protocol |
| `--author <作者>` | 服务器作者信息 | shadow |
| `--license <许可证>` | 服务器许可证信息 | MIT |
| `--homepage <主页>` | 服务器主页URL | https://github.com/shadowcz007/mcp_server.exe |

使用示例：

Example usage:

```bash
# 使用自定义名称和端口运行服务器
# Run server with custom name and port
node dist/server.js --server-name my-mcp-server --port 8080

# 使用完整配置运行服务器
# Run server with full configuration
node dist/server.js --mcp-js ./my-config.js --server-name custom-server --port 8080 --version 2.0.0 --description "My Custom MCP Server" --author "Your Name" --license "Apache-2.0" --homepage "https://example.com/mcp-server"

# 使用可执行文件和自定义配置
# Run executable with custom configuration
./executables/mcp_server --mcp-js ./my-config.js --server-name custom-server --port 8080
```

## 自定义配置 | Custom Configuration

服务器支持通过命令行参数 `--mcp-js` 加载自定义配置文件：

The server supports loading custom configuration files via the command line parameter `--mcp-js`:

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