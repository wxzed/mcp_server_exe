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
let mcpServerName = null;
let port = 3000;
let version = "1.0.0";
let description = "MCP Server for Model Context Protocol";
let author = "shadow";
let license = "MIT";
let homepage = "https://github.com/shadowcz007/mcp_server.exe";
 

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mcp-js' && i + 1 < args.length) {
    customConfigPath = args[i + 1];
    i++; // 跳过下一个参数，因为它是配置文件路径
    continue;
  }
  if (args[i] === '--server-name' && i + 1 < args.length) {
    mcpServerName = args[i + 1];
    i++; // 跳过下一个参数，因为它是服务器名称
    continue;
  }
  if (args[i] === '--version' && i + 1 < args.length) {
    version = args[i + 1];
    i++; // 跳过下一个参数，因为它是版本号
    continue;
  }
  if (args[i] === '--port' && i + 1 < args.length) {
    port = parseInt(args[i + 1]);
    i++; // 跳过下一个参数，因为它是端口号
    continue;
  }
  if (args[i] === '--description' && i + 1 < args.length) {
    description = args[i + 1];
    i++; // 跳过下一个参数，因为它是描述
    continue;
  }
  if (args[i] === '--author' && i + 1 < args.length) {
    author = args[i + 1];
    i++; // 跳过下一个参数，因为它是作者
    continue;
  }
  if (args[i] === '--license' && i + 1 < args.length) { 
    license = args[i + 1];
    i++; // 跳过下一个参数，因为它是许可证
    continue;
  }
  if (args[i] === '--homepage' && i + 1 < args.length) {
    homepage = args[i + 1];
    i++; // 跳过下一个参数，因为它是主页
    continue;
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
  name: mcpServerName || "mcp_server_exe",
  version: version || "1.0.0",
  description: description || "MCP Server for Model Context Protocol",
  author: author || "shadow",
  license: license || "MIT",
  homepage: homepage || "https://github.com/shadowcz007/mcp_server.exe"
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

const PORT = process.env.PORT || port;
app.listen(PORT, () => {

  let config={"mcpServers":{}};

  if(mcpServerName){
    config["mcpServers"][mcpServerName]={
      "url": `http://127.0.0.1:${PORT}/sse`
    }
  } else {
    config["mcpServers"]["mcp_server_exe"]={
      "url": `http://127.0.0.1:${PORT}/sse`
    }
  }

  console.log(`\nMCP Server config is: ${JSON.stringify(config,null,2)}`);

  console.log(`\nMCP Server streamable is running on port ${PORT}/mcp`);
  console.log(`\nMCP Server sse is running on port ${PORT}/sse`);
   
}); 