function configureMcp (server, ResourceTemplate, z) {
  let client = server._client
//   console.log(client)
  const sendNotify = client.sendNotify

  // Configure custom tool
  server.tool('custom-tool', { message: z.string() }, async ({ message }) => {
    sendNotify(
      [
        {
          type: 'desktop',
          title: '任务执行结果',
          icon: ''
        }
      ],
      [
        {
          operation: { name: 'custom-tool' },
          result: { content: [{ type: 'text', text: message }] }
        }
      ]
    )

    return {
      content: [{ type: 'text', text: `custom tool response: ${message}` }]
    }
  })
}

module.exports = { configureMcp }
