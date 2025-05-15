const express = require("express");
const { McpServer,ResourceTemplate } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let customConfigPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mcp-js' && i + 1 < args.length) {
    customConfigPath = args[i + 1];
    break;
  }
}

// Default or custom configuration
let configureMcp;
if (customConfigPath && fs.existsSync(customConfigPath)) {
  const customConfigFullPath = path.resolve(process.cwd(), customConfigPath);
  console.log(`Loading custom MCP config from: ${customConfigFullPath}`);
  configureMcp = require(customConfigFullPath).configureMcp;
} else {
  console.log('Using default MCP config');
  configureMcp = require('./tools/mcpConfig.js').configureMcp;
}

const server = new McpServer({
  name: "backwards-compatible-server",
  version: "1.0.0"
});

// Configure MCP server with tools, resources, and prompts
configureMcp(server, ResourceTemplate, z);

const app = express();

// Configure CORS
const corsOptions = {
  origin: '*', // Allow all origins, consider setting specific domains in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // Allow credentials
  maxAge: 86400 // Preflight request cache time in seconds
};

// Enable CORS
app.use(cors(corsOptions));

// Enable JSON parsing
app.use(express.json());

// Store transports for each session type
const transports = {
  streamable: new Map(),
  sse: new Map()
};

// Modern Streamable HTTP endpoint
app.all('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => uuidv4(),
    onsessioninitialized: (sessionId) => {
      console.log(`New session initialized: ${sessionId}`);
    }
  });
  
  if (transport.sessionId) {
    transports.streamable.set(transport.sessionId, transport);
    
    res.on("close", () => {
      if (transport.sessionId) {
        transports.streamable.delete(transport.sessionId);
      }
    });
    
    await transport.handleRequest(req, res, req.body);
    await server.connect(transport);
  }
});

// Legacy SSE endpoint for older clients
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  if (transport.sessionId) {
    transports.sse.set(transport.sessionId, transport);
    
    res.on("close", () => {
      if (transport.sessionId) {
        transports.sse.delete(transport.sessionId);
      }
    });
    
    await server.connect(transport);
  }
});

// Legacy message endpoint for older clients
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.sse.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server sse is running on port ${PORT}/sse`);
  console.log(`MCP Server mcp is running on port ${PORT}/mcp`);
}); 