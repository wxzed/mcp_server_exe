import sys
import json
import asyncio
import websockets
import threading
import time
from datetime import datetime

# 修改为你的灯设备WebSocket地址
WS_URL = "ws://192.168.1.35/ws"

def get_timestamp():
    """返回易读的时间戳"""
    return datetime.now().strftime('%H:%M:%S.%f')[:-3]

def get_time_diff(start_time):
    """计算与开始时间的差值，单位：秒"""
    return time.perf_counter() - start_time

# 读取stdin的线程，将消息放入asyncio队列
def read_stdin(loop, send_queue):
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        now = get_timestamp()
        t_recv = time.perf_counter()  # 使用perf_counter更准确
        print(f"[STDIO代理] 收到stdin: {line} @ {now}", file=sys.stderr)
        try:
            data = json.loads(line)
            data["_t_recv"] = t_recv  # 打上时间戳，方便计算总耗时
            print(f"[STDIO代理] 放入队列: {data} @ {now}", file=sys.stderr)
            loop.call_soon_threadsafe(send_queue.put_nowait, data)
        except Exception as e:
            print(f"[STDIO代理] 解析stdin失败: {e}", file=sys.stderr)

async def ws_stdio_bridge():
    send_queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    threading.Thread(target=read_stdin, args=(loop, send_queue), daemon=True).start()

    while True:
        try:
            print(f"[STDIO代理] 正在连接到灯设备: {WS_URL} @ {get_timestamp()}", file=sys.stderr)
            async with websockets.connect(WS_URL) as ws:
                print(f"[STDIO代理] 已连接到灯设备 @ {get_timestamp()}", file=sys.stderr)

                async def ws_recv():
                    try:
                        async for message in ws:
                            now = get_timestamp()
                            t_recv = time.perf_counter()
                            print(f"[灯设备] 收到: {message} @ {now}", file=sys.stderr)
                            try:
                                msg = json.loads(message)
                                # 如果是tools/call响应，打印总耗时
                                if "id" in msg and "result" in msg:
                                    t0 = msg.get("_t_recv", None)
                                    if t0:
                                        total_time = get_time_diff(t0)
                                        print(f"[DEBUG] 灯设备响应总耗时: {total_time:.3f}s", file=sys.stderr)
                            except Exception as e:
                                print(f"[STDIO代理] 解析灯设备响应失败: {e}", file=sys.stderr)
                            
                            # 输出到stdout并立即刷新
                            print(message, flush=True)
                    except Exception as e:
                        print(f"[STDIO代理] ws_recv异常: {e}", file=sys.stderr)

                async def ws_send():
                    while True:
                        try:
                            t_get_start = time.perf_counter()
                            data = await send_queue.get()
                            t_get_end = time.perf_counter()
                            get_time = get_time_diff(t_get_start)
                            now = get_timestamp()
                            
                            print(f"[STDIO代理] ws_send: send_queue.get()耗时: {get_time:.3f}s @ {now}", file=sys.stderr)
                            print(f"[STDIO代理] ws_send准备转发: {data} @ {now}", file=sys.stderr)

                            t_send_start = time.perf_counter()
                            await ws.send(json.dumps(data))
                            t_send_end = time.perf_counter()
                            send_time = get_time_diff(t_send_start)
                            now = get_timestamp()
                            
                            print(f"[STDIO代理] 已转发到灯设备: {data} @ {now}，ws.send耗时: {send_time:.3f}s", file=sys.stderr)
                        except Exception as e:
                            print(f"[STDIO代理] ws_send异常: {e} @ {get_timestamp()}", file=sys.stderr)

                await asyncio.gather(ws_recv(), ws_send())
        except Exception as e:
            print(f"[STDIO代理] WebSocket连接失败: {e}，3秒后重连... @ {get_timestamp()}", file=sys.stderr)
            await asyncio.sleep(3)

if __name__ == "__main__":
    try:
        asyncio.run(ws_stdio_bridge())
    except KeyboardInterrupt:
        print("[STDIO代理] 退出", file=sys.stderr) 