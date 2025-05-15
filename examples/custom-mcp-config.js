/**
 * 自定义MCP配置示例文件
 * 用法: mcp_server --mcp-js ./custom-mcp-config.js
 */
function configureMcp(server, ResourceTemplate, z) {
    // 配置自定义Echo资源
    server.resource(
        "custom-echo",
        new ResourceTemplate("custom-echo://{message}", { list: undefined }),
        async(uri, { message }) => ({
            contents: [{
                uri: uri.href,
                text: `自定义资源响应: ${message}`
            }]
        })
    );

    // 配置自定义工具
    server.tool(
        "custom-tool", { message: z.string() },
        async({ message }) => ({
            content: [{ type: "text", text: `自定义工具响应: ${message}` }]
        })
    );

    // 配置自定义提示
    server.prompt(
        "custom-prompt", { message: z.string() },
        ({ message }) => ({
            messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `自定义提示处理消息: ${message}`
                }
            }]
        })
    );

    // 可以在这里添加更多工具、资源和提示的配置
}

module.exports = { configureMcp };