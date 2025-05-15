/**
 * 配置MCP服务器的资源、工具和提示
 */
function configureMcp(server, ResourceTemplate, z) {
    // 配置Echo资源
    server.resource(
        "echo",
        // 资源模板应该在server中定义，这里只提供参数
        new ResourceTemplate("echo://{message}", { list: undefined }),
        async(uri, { message }) => ({
            contents: [{
                uri: uri.href,
                text: `Resource echo: ${message}`
            }]
        })
    );


    server.resource(
        "schema",
        "schema://main",
        async(uri) => {

            try {
                return {
                    contents: [{
                        uri: uri.href,
                        text: 'github.com/shadowcz007/mcp_server.exe'
                    }]
                };
            } finally {

            }
        }
    );


    // 配置Echo工具
    server.tool(
        "echo", { message: z.string() },
        async({ message }) => ({
            content: [{ type: "text", text: `Tool echo: ${message}` }]
        })
    );

    // 配置Echo提示
    server.prompt(
        "echo", { message: z.string() },
        ({ message }) => ({
            messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `Please process this message: ${message}`
                }
            }]
        })
    );
    // 可以在这里添加更多工具、资源和提示的配置
}

module.exports = { configureMcp };