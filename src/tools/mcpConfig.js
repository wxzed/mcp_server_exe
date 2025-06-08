/**
 * Configure MCP server resources, tools, and prompts
 */
function mcpPlugin (server, ResourceTemplate, z) {
  const schema = z._fieldsToZodSchema([
    {
      name: 'username',
      type: 'string',
      description: '用户名',
      isOptional: false
    },
    {
      name: 'age',
      type: 'number',
      description: '年龄',
      isOptional: true
    },
    {
      name: 'role',
      type: 'enum',
      description: '角色',
      isOptional: false,
      options: ['admin', 'user', 'guest']
    }
  ])

  server.tool('user', 'store user', schema, async args => ({
    content: [{ type: 'text', text: JSON.stringify(args) }]
  }))

  // Configure Echo resource
  server.resource(
    'echo',
    // Resource templates should be defined in the server, only parameters are provided here
    new ResourceTemplate('echo://{message}', { list: undefined }),
    async (uri, { message }) => ({
      contents: [
        {
          uri: uri.href,
          text: `Resource echo: ${message}`
        }
      ]
    })
  )

  server.resource('schema', 'schema://main', async uri => {
    try {
      return {
        contents: [
          {
            uri: uri.href,
            text: 'github.com/shadowcz007/mcp_server.exe'
          }
        ]
      }
    } finally {
    }
  })

  // Configure Echo tool
  server.tool('echo', { message: z.string() }, async ({ message }) => ({
    content: [{ type: 'text', text: `Tool echo: ${message}` }]
  }))

  // Configure Echo prompt
  server.prompt('echo', { message: z.string() }, ({ message }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please process this message: ${message}`
        }
      }
    ]
  }))
  // Add more tool, resource, and prompt configurations here
}

module.exports = { mcpPlugin }
