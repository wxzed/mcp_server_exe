function configureMcp (server, ResourceTemplate, z) {
  // Configure custom tool
  server.tool('custom-tool', { message: z.string() }, async ({ message }) => {
    let dbPath = 'test.sqlite'
    console.log('#dbPath', dbPath)

    let client = server._client
    const db = await client.createDatabase(dbPath)
    db.exec('CREATE TABLE test (id INT, name TEXT);')
    
    db._saveDBFile()

    return {
      content: [{ type: 'text', text: `custom tool response: ${message}` }]
    }
  })
}

module.exports = { configureMcp }
