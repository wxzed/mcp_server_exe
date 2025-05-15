/**
 * Custom MCP configuration example file
 * Usage: mcp_server --mcp-js ./custom-mcp-config.js
 */

function configureServer(server, ResourceTemplate, z) {
    return {
        serverName: "dynamic-mcp-server",
        port: 9090,
        version: "1.2.0",
        description: "动态配置的 MCP 服务器实例",
        author: "yourname",
        license: "MIT",
        homepage: "https://github.com/yourname/mcp-server"
    }
}

function configureMcp(server, ResourceTemplate, z) {
    // Configure custom Echo resource
    server.resource(
        "custom-echo",
        new ResourceTemplate("custom-echo://{message}", { list: undefined }),
        async(uri, { message }) => ({
            contents: [{
                uri: uri.href,
                text: `custom resource echo: ${message}`
            }]
        })
    );

    // Configure custom tool
    server.tool(
        "custom-tool", { message: z.string() },
        async({ message }) => ({
            content: [{ type: "text", text: `custom tool response: ${message}` }]
        })
    );

    // Configure custom prompt
    server.prompt(
        "custom-prompt", { message: z.string() },
        ({ message }) => ({
            messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `custom prompt process message: ${message}`
                }
            }]
        })
    );

    // Add more tool, resource, and prompt configurations here
}

module.exports = { configureMcp, configureServer };