/**
 * 测试自定义配置的脚本
 * 使用方法: node scripts/test-custom-config.js
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// 确保example目录存在
const exampleDir = path.join(__dirname, '../examples');
if (!fs.existsSync(exampleDir)) {
    fs.mkdirSync(exampleDir, { recursive: true });
    console.log('Created examples directory');
}

// 自定义配置文件路径
const customConfigPath = path.join(exampleDir, 'custom-mcp-config.js');

// 如果自定义配置文件不存在，则创建一个简单的示例
if (!fs.existsSync(customConfigPath)) {
    console.log('Creating example custom config file...');
    const exampleConfig = `/**
 * 自定义MCP配置示例文件
 * 用法: mcp_server --mcp-js ./custom-mcp-config.js
 */
function configureMcp(server, ResourceTemplate, z) {
    // 配置测试资源
    server.resource(
        "test",
        new ResourceTemplate("test://{message}", { list: undefined }),
        async(uri, { message }) => ({
            contents: [{
                uri: uri.href,
                text: \`测试资源响应: \${message}\`
            }]
        })
    );

    console.log('已加载自定义MCP配置');
}

module.exports = { configureMcp };`;

    fs.writeFileSync(customConfigPath, exampleConfig);
    console.log('Created example custom config file');
}

// 运行服务器实例
console.log('Starting server with custom config...');
const serverPath = path.join(__dirname, '../dist/server.js');

// 定义完整的服务器参数
const serverArgs = [
    serverPath,
    '--mcp-js', customConfigPath
];

// 启动服务器进程
const server = spawn('node', serverArgs, {
    stdio: 'inherit',
    shell: true
});

// 处理进程事件
server.on('error', (error) => {
    console.error('Failed to start server:', error);
});

server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
});

console.log('Server started. Press Ctrl+C to stop.');