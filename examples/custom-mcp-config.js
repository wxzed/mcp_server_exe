/**
 * Custom MCP configuration example file
 * Usage: mcp_server --mcp-js ./custom-mcp-config.js
 */

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

module.exports = { configureMcp };