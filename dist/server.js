const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
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
    }
    else {
        res.status(400).send('No transport found for sessionId');
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`CORS is enabled with options:`, corsOptions);
});
