import asyncio
import threading
import queue
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import websockets

WS_URL = "ws://192.168.1.35/ws"
SSE_PORT = 3001

msg_queue = queue.Queue()
ws_send_queue = queue.Queue()
ws_conn = None

app = Flask(__name__)
CORS(app)

@app.route('/sse')
def sse():
    def event_stream():
        # 先推送一条，确保头部立即发出
        yield "data: connected\n\n"
        while True:
            try:
                # 设置超时，避免阻塞导致SSE头部不发出
                msg = msg_queue.get(timeout=5)
                yield f"data: {msg}\n\n"
            except queue.Empty:
                # 定期推送心跳，防止连接断开
                yield "data: heartbeat\n\n"
    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/send', methods=['POST'])
def send():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400
    ws_send_queue.put(data['message'])
    return jsonify({'status': 'ok'})

async def ws_client():
    global ws_conn
    while True:
        try:
            async with websockets.connect(WS_URL) as ws:
                ws_conn = ws
                print(f"已连接到WebSocket: {WS_URL}")
                # 接收和发送消息
                async def recv_loop():
                    async for message in ws:
                        print(f"收到消息: {message}")
                        msg_queue.put(message)
                async def send_loop():
                    while True:
                        msg = await asyncio.get_event_loop().run_in_executor(None, ws_send_queue.get)
                        await ws.send(msg)
                await asyncio.gather(recv_loop(), send_loop())
        except Exception as e:
            print(f"WebSocket连接失败: {e}，3秒后重连...")
            await asyncio.sleep(3)

def start_ws_client():
    asyncio.run(ws_client())

if __name__ == '__main__':
    t = threading.Thread(target=start_ws_client, daemon=True)
    t.start()
    app.run(host="0.0.0.0", port=SSE_PORT, threaded=True)