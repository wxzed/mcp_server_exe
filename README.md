# MCP Server.exe

把 MCP (Model Context Protocol) 服务器制作成可执行文件，支持现代和传统客户端连接。

## 功能特性

- 支持现代 Streamable HTTP 端点 (/mcp)
- 支持传统 SSE 端点 (/sse) 和消息端点 (/messages)
- 可自定义配置工具、资源和提示

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 运行

```bash
npm start
```

或者开发模式：

```bash
npm run dev
```

## 自定义配置

服务器支持通过命令行参数 `--mcp-js` 加载自定义配置文件：

```bash
# 使用开发模式加载自定义配置
node src/server.ts --mcp-js ./examples/custom-mcp-config.js

# 使用构建后的程序加载自定义配置
node dist/server.js --mcp-js ./examples/custom-mcp-config.js

# 直接使用打包后的可执行文件加载自定义配置
./executables/mcp_server --mcp-js ./examples/custom-mcp-config.js
```

### 自定义配置文件格式

自定义配置文件应导出 `configureMcp` 函数，该函数接收三个参数：
- `server`: MCP 服务器实例
- `ResourceTemplate`: 用于定义资源模板的类
- `z`: Zod 验证库实例

示例配置文件可参考 `examples/custom-mcp-config.js`。

## 打包

为 macOS 打包：

```bash
npm run package-mac
```

为 Windows 打包：

```bash
npm run package-win
```

打包后的可执行文件将生成在 `executables` 目录中。

## API 端点

- `/mcp`: 现代 Streamable HTTP 端点
- `/sse`: 传统 SSE 端点
- `/messages`: 传统消息端点

## 许可证

ISC

## 环境变量

- `PORT` - 服务器端口号（默认：3000） 