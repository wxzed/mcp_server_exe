
function configureMcp(server, ResourceTemplate, z) {
    
    let client=server._client;
    console.log(client);

    // Configure custom tool
    server.tool(
        "custom-tool", { message: z.string() },
        async({ message }) => ({
            content: [{ type: "text", text: `custom tool response: ${message}` }]
        })
    );

    
}

module.exports = { configureMcp };