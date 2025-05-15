# MCP Server

这是一个支持现代和传统客户端的 MCP (Model Context Protocol) 服务器实现。

## 功能特点

- 支持现代 Streamable HTTP 传输
- 支持传统 SSE (Server-Sent Events) 传输
- 提供完整的会话管理
- 可打包为独立的可执行文件

## 安装

```bash
npm install
```

## 开发

```bash
# 开发模式运行
npm run dev

# 构建项目
npm run build

# 运行构建后的项目
npm start
```

## 打包为可执行文件

```bash
# 构建项目
npm run build

# 打包为可执行文件
npm run package
```

打包后的可执行文件将位于 `executables` 目录下，支持以下平台：
- Windows (x64)
- macOS (x64)
- Linux (x64)

## API 端点

- `/mcp` - 现代 Streamable HTTP 端点
- `/sse` - 传统 SSE 端点
- `/messages` - 传统消息端点

## 环境变量

- `PORT` - 服务器端口号（默认：3000） 