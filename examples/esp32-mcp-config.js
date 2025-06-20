/**
 * esp32-mcp-config.js
 *
 * 用于通过 MCP Server（小智/Cursor 生态）注册"灯设备"控制工具，
 * 适配 ws_stdio_bridge.py 作为下游代理，所有参数和调用内容原样转发。
 *
 * 使用方法：
 *   mcp_server.exe --mcp-js ./examples/esp32-mcp-config.js --mcp-config ./examples/mcp-stdio.json
 *
 * 工具列表：
 *   - turn_on_lamp  打开灯
 *   - turn_off_lamp 关闭灯
 *
 * 参数说明：
 *   message（可选）：附加消息或指令内容，原样转发给下游。
 */

function configureMcp(server, ResourceTemplate, z) {
  // 打开灯
  server.tool(
    'turn_on_lamp',
    '打开灯设备',
    {
      message: z.string().optional().describe('附加消息，可选')
    },
    async (args, context) => {
      // 透传到下游
      return await server._client.callTool('turn_on_lamp', args)
    }
  )

  // 关闭灯
  server.tool(
    'turn_off_lamp',
    '关闭灯设备',
    {
      message: z.string().optional().describe('附加消息，可选')
    },
    async (args, context) => {
      return await server._client.callTool('turn_off_lamp', args)
    }
  )
}

module.exports = { configureMcp } 