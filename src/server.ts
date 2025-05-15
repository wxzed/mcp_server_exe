const express = require("express");
const { McpServer,ResourceTemplate } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { defaultConfig, loadServerConfig, defaultConfigureMcp } = require('./tools/serverConfig.js');

// 解析命令行参数
const args = process.argv.slice(2);
let customConfigPath = null;

// 定义 cliArgs 接口
interface CliArgs {
  serverName?: string;
  port?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
}

// 创建 cliArgs 对象
let cliArgs: CliArgs = {};

// 处理命令行参数
for (let i = 0; i < args.length; i++) {
  // 只使用 --mcp-js 参数
  if (args[i] === '--mcp-js' && i + 1 < args.length) {
    customConfigPath = args[i + 1];
    i++; // 跳过下一个参数，因为它是配置文件路径
    continue;
  }
  if (args[i] === '--server-name' && i + 1 < args.length) {
    cliArgs.serverName = args[i + 1];
    i++; 
    continue;
  }
  if (args[i] === '--port' && i + 1 < args.length) {
    cliArgs.port = args[i + 1];
    i++; 
    continue;
  }
  if (args[i] === '--version' && i + 1 < args.length) {
    cliArgs.version = args[i + 1];
    i++; 
    continue;
  }
  if (args[i] === '--description' && i + 1 < args.length) {
    cliArgs.description = args[i + 1];
    i++; 
    continue;
  }
  if (args[i] === '--author' && i + 1 < args.length) {
    cliArgs.author = args[i + 1];
    i++; 
    continue;
  }
  if (args[i] === '--license' && i + 1 < args.length) { 
    cliArgs.license = args[i + 1];
    i++; 
    continue;
  }
  if (args[i] === '--homepage' && i + 1 < args.length) {
    cliArgs.homepage = args[i + 1];
    i++; 
    continue;
  }
}

// 加载配置文件
let customConfig = {};
let configureMcp = null;

if (customConfigPath && fs.existsSync(customConfigPath)) {
  const customConfigFullPath = path.resolve(process.cwd(), customConfigPath);
  console.log(`加载配置文件: ${customConfigFullPath}`);
  
  try {
    const customModule = require(customConfigFullPath);
    
    // 加载服务器配置
    if (typeof customModule === 'object') {
      // 如果导出的是一个对象，直接作为服务器配置
      customConfig = customModule;
    }
    
    // 检查并加载 configureServer 函数
    if (customModule.configureServer && typeof customModule.configureServer === 'function') {
      // 如果存在 configureServer 函数，则调用它获取服务器配置
      console.log('发现 configureServer 函数，使用其返回值作为服务器配置');
      const serverConfig = customModule.configureServer();
      if (serverConfig && typeof serverConfig === 'object') {
        customConfig = serverConfig;
      }
    }
    
    // 检查并加载 configureMcp 函数
    if (customModule.configureMcp && typeof customModule.configureMcp === 'function') {
      // 如果存在 configureMcp 函数，则使用它配置 MCP 服务器
      console.log('发现 configureMcp 函数，将用于配置 MCP 服务器');
      configureMcp = customModule.configureMcp;
    }
  } catch (error) {
    console.error(`加载配置文件失败: ${error.message}`);
  }
}

// 如果没有找到 configureMcp 函数，则使用默认的
if (!configureMcp) {
  console.log('使用默认 MCP 配置');
  configureMcp = require('./tools/mcpConfig.js').configureMcp;
}

// 合并配置
const config = loadServerConfig(customConfig, cliArgs);

// 创建MCP服务器实例
const server = new McpServer({
  name: config.serverName,
  version: config.version,
  description: config.description,
  author: config.author,
  license: config.license,
  homepage: config.homepage
});

// 配置MCP服务器的工具、资源和提示
configureMcp(server, ResourceTemplate, z);

const app = express();

// 配置CORS
const corsOptions = {
  origin: '*', // 允许所有来源，生产环境中应考虑设置特定域名
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // 允许凭据
  maxAge: 86400 // 预检请求缓存时间（秒）
};

// 启用CORS
app.use(cors(corsOptions));

// 启用JSON解析
app.use(express.json());

// 存储每种会话类型的传输
const transports = {
  streamable: new Map(),
  sse: new Map()
};

// 现代化Streamable HTTP端点
app.all('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => uuidv4(),
    onsessioninitialized: (sessionId) => {
      console.log(`新会话已初始化: ${sessionId}`);
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

// 传统SSE端点（用于旧版客户端）
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

// 传统消息端点（用于旧版客户端）
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.sse.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('未找到会话ID对应的传输');
  }
});

const PORT = process.env.PORT || config.port;
app.listen(PORT, () => {

  let mcpConfig = {"mcpServers":{}};

  mcpConfig["mcpServers"][config.serverName] = {
    "url": `http://127.0.0.1:${PORT}/sse`
  };

  console.log(`\nMCP服务器配置: ${JSON.stringify(mcpConfig, null, 2)}`);
  console.log(`\nMCP服务器(streamable)运行在端口 ${PORT}/mcp`);
  console.log(`\nMCP服务器(sse)运行在端口 ${PORT}/sse`);
}); 