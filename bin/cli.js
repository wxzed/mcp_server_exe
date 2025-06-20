#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// 获取 dist/server.js 的路径
const serverPath = path.join(__dirname, '../dist/server.js');

// 检查 dist/server.js 是否存在
if (!fs.existsSync(serverPath)) {
    console.error('错误: 找不到 dist/server.js 文件');
    console.error('请先运行 "npm run build" 构建项目');
    process.exit(1);
}

// 如果没有参数，显示帮助信息
if (process.argv.length === 2) {
    console.log(`
MCP Server CLI Tool v${require('../package.json').version}

使用方法: npx mcp_exe [选项]

选项:
  --ws <url>             WebSocket 服务器地址
  --mcp-js <path>        MCP JavaScript 配置文件路径
  --mcp-config <path>    MCP JSON 配置文件路径
  --server-name <name>   服务器名称
  --port <port>          端口号 (默认: 3002)
  --version <version>    版本号
  --description <desc>   描述
  --author <author>      作者
  --license <license>    许可证
  --homepage <url>       主页
  --transport <type>     传输类型 (sse/stdio)
  --cronjob <path>       定时任务配置文件
  --cursor-link          启用 Cursor 链接
  --log-level <level>    日志级别
  --help, -h            显示此帮助信息

示例:
  npx mcp_exe --port 3000 --mcp-config ./examples/mcp.json
  npx mcp_exe --ws ws://localhost:8080
  npx mcp_exe --mcp-js ./examples/custom-config.js
  npx mcp_exe --cronjob ./examples/cronjob.json
    `);
    process.exit(0);
}

// 直接加载并执行 server.js
try {
    require(serverPath);
} catch (error) {
    console.error('启动服务器时出错:', error.message);
    process.exit(1);
}