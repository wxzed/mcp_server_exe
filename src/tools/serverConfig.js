/**
 * 服务器默认配置和配置加载方法
 */

// 默认服务器配置
const defaultConfig = {
    serverName: "mcp_server_exe",
    port: 3000,
    version: "1.0.0",
    description: "MCP Server for Model Context Protocol",
    author: "shadow",
    license: "MIT",
    homepage: "https://github.com/shadowcz007/mcp_server.exe"
};

/**
 * 加载服务器配置
 * @param {Object} customConfig - 自定义配置对象（可选）
 * @param {Object} cliArgs - 命令行参数对象（可选）
 * @returns {Object} 合并后的配置
 */
function loadServerConfig(customConfig = {}, cliArgs = {}) {
    // 合并配置优先级: 默认配置 < 自定义配置文件 < 命令行参数
    const config = {
        ...defaultConfig,
        ...customConfig
    };

    // 如果存在命令行参数，它们优先级最高
    if (cliArgs.serverName) config.serverName = cliArgs.serverName;
    if (cliArgs.port) config.port = parseInt(cliArgs.port);
    if (cliArgs.host) config.host = cliArgs.host;
    if (cliArgs.version) config.version = cliArgs.version;
    if (cliArgs.description) config.description = cliArgs.description;
    if (cliArgs.author) config.author = cliArgs.author;
    if (cliArgs.license) config.license = cliArgs.license;
    if (cliArgs.homepage) config.homepage = cliArgs.homepage;
    if (cliArgs.transport) config.transport = cliArgs.transport;
    if (cliArgs.mcpConfig) config.mcpConfig = cliArgs.mcpConfig;
    return config;
}

/**
 * 默认的 MCP 配置函数
 * @param {Object} server - MCP 服务器实例
 * @param {Class} ResourceTemplate - 资源模板类
 * @param {Object} z - Zod 验证库实例
 */
function defaultConfigureMcp(server, ResourceTemplate, z) {
    try {
        // 如果用户没有提供 configureMcp，则使用默认的 mcpConfig.js
        return require('./mcpConfig.js').configureMcp(server, ResourceTemplate, z);
    } catch (error) {
        console.error('加载默认 MCP 配置失败:', error);
        // 提供一个空实现，确保程序不会崩溃
        return () => {};
    }
}

module.exports = {
    defaultConfig,
    loadServerConfig,
    defaultConfigureMcp
};