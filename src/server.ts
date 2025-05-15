import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Request, Response } from "express";
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const server = new McpServer({
  name: "backwards-compatible-server",
  version: "1.0.0"
});

const app = express();

// 配置 CORS
const corsOptions = {
  origin: '*', // 允许所有来源访问，生产环境建议设置具体的域名
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // 允许携带凭证
  maxAge: 86400 // 预检请求结果缓存时间，单位：秒
};

// 启用 CORS
app.use(cors(corsOptions));

// 启用 JSON 解析
app.use(express.json());

// Store transports for each session type
const transports = {
  streamable: new Map<string, StreamableHTTPServerTransport>(),
  sse: new Map<string, SSEServerTransport>()
};

// Modern Streamable HTTP endpoint
app.all('/mcp', async (req: Request, res: Response) => {
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
app.get('/sse', async (req: Request, res: Response) => {
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
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.sse.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`CORS is enabled with options:`, corsOptions);
}); 