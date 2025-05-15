/**
 * 测试打包后的应用程序
 * 使用方法: node scripts/test-packaged-app.js
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// 确定操作系统和可执行文件路径
const isWindows = os.platform() === 'win32';
const executableName = isWindows ? 'mcp_server.exe' : 'mcp_server';
const executablePath = path.join(__dirname, '../executables', executableName);

// 自定义配置文件路径
const customConfigPath = path.join(__dirname, '../examples/custom-mcp-config.js');

// 检查可执行文件是否存在
if (!fs.existsSync(executablePath)) {
    console.error(`错误: 找不到可执行文件 ${executablePath}`);
    console.log('请先运行打包命令:');
    console.log(isWindows ? 'npm run package-win' : 'npm run package-mac');
    process.exit(1);
}

// 检查配置文件是否存在
if (!fs.existsSync(customConfigPath)) {
    console.error(`错误: 找不到配置文件 ${customConfigPath}`);
    console.log('请先运行测试脚本创建样例配置:');
    console.log('node scripts/test-custom-config.js');
    process.exit(1);
}

// 运行打包后的可执行文件
console.log(`启动打包的应用程序 ${executableName} 并加载自定义配置...`);

// 启动应用程序进程
const app = spawn(executablePath, ['--mcp-js', customConfigPath], {
    stdio: 'inherit',
    shell: true
});

// 处理进程事件
app.on('error', (error) => {
    console.error('启动应用程序失败:', error);
});

app.on('close', (code) => {
    console.log(`应用程序进程已退出，退出代码: ${code}`);
});

console.log('应用程序已启动。按 Ctrl+C 终止。');