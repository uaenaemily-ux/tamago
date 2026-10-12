"""用本机的 Chrome（无界面模式）给网页截图，等页面真正画完、图片和字体都加载好再截。

用法（先运行 python3 tools/serve.py 启动本地预览）：
    python3 tools/screenshot.py "#/welcome" 输出.png              # 手机宽度：390×844，2 倍清晰度
    python3 tools/screenshot.py "#/welcome" 输出.png --desktop    # 电脑宽度：1280×900
    python3 tools/screenshot.py "#/home" 输出.png --full          # 截整页（不只是第一屏）

为什么不直接用 chrome --screenshot：
- 它在页面 load 事件时就截图，这时本网页可能还在读 IndexedDB、图片还没加载，截出来是空白或缺图
- 它的窗口最小宽度约 500px，没法真正模拟 390px 宽的手机

做法：用 Chrome 调试协议（DevTools Protocol）控制浏览器：先设置屏幕尺寸，再打开页面，
反复检查"页面已渲染 + 字体加载完 + 一段时间内没有新的网络请求"，然后截图。
每次都用全新的临时浏览器资料夹，不碰你自己的 Chrome 数据；截完自动删除。
只用 Python 自带的模块。
"""
import argparse
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE_URL = "http://localhost:8000/"


# ---------- 最小的 WebSocket 客户端（Chrome 调试协议需要） ----------
class WebSocket:
    def __init__(self, url):
        assert url.startswith("ws://")
        host_port, path = url[5:].split("/", 1)
        host, port = host_port.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((
            f"GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        ).encode())
        response = b""
        while b"\r\n\r\n" not in response:
            response += self.sock.recv(4096)
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            raise RuntimeError("WebSocket 连接失败：" + response.decode(errors="replace"))
        self.buffer = response.split(b"\r\n\r\n", 1)[1]

    def _read(self, n):
        while len(self.buffer) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError("连接被关闭")
            self.buffer += chunk
        data, self.buffer = self.buffer[:n], self.buffer[n:]
        return data

    def send(self, text):
        payload = text.encode()
        header = bytearray([0x81])  # 文本帧
        n = len(payload)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        mask = os.urandom(4)
        header += mask
        self.sock.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def recv(self):
        message = b""
        while True:
            b1, b2 = self._read(2)
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            message += self._read(n)
            if b1 & 0x80:  # 最后一帧
                return message.decode()


class Page:
    def __init__(self, ws_url):
        self.ws = WebSocket(ws_url)
        self.next_id = 0

    def call(self, method, **params):
        self.next_id += 1
        my_id = self.next_id
        self.ws.send(json.dumps({"id": my_id, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == my_id:
                if "error" in msg:
                    raise RuntimeError(f"{method} 失败：{msg['error']}")
                return msg.get("result", {})

    def evaluate(self, expression):
        result = self.call("Runtime.evaluate", expression=expression, returnByValue=True, awaitPromise=True)
        return result.get("result", {}).get("value")


# 页面是否"真正画完"：路由已渲染内容、字体加载完、所有 <img> 加载完
READY_JS = """
(async () => {
  const page = document.getElementById('page');
  if (!page || !page.children.length) return false;
  if (document.fonts.status !== 'loaded') return false;
  if ([...document.images].some((img) => !img.complete)) return false;
  return performance.getEntriesByType('resource').length;
})()
"""


def wait_until_ready(page, timeout=20):
    """等到页面渲染完成，并且连续 1 秒没有新的网络请求（CSS 背景图等也加载完）"""
    deadline = time.time() + timeout
    last_count, stable_since = None, None
    while time.time() < deadline:
        count = page.evaluate(READY_JS)
        if count:
            if count == last_count:
                if time.time() - stable_since >= 1.0:
                    return True
            else:
                last_count, stable_since = count, time.time()
        time.sleep(0.2)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("route", help='页面地址里 # 之后的部分，如 "#/welcome"')
    ap.add_argument("output")
    ap.add_argument("--desktop", action="store_true", help="电脑宽度 1280×900（默认手机 390×844）")
    ap.add_argument("--full", action="store_true", help="截整页")
    args = ap.parse_args()

    width, height, scale, mobile = (1280, 900, 1, False) if args.desktop else (390, 844, 2, True)
    profile = tempfile.mkdtemp(prefix="tamago-shot-")
    chrome = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         f"--user-data-dir={profile}", "--remote-debugging-port=0", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        # Chrome 启动后会把调试端口写进这个文件
        port_file = os.path.join(profile, "DevToolsActivePort")
        for _ in range(100):
            if os.path.exists(port_file) and open(port_file).read().strip():
                break
            time.sleep(0.1)
        port = open(port_file).read().split()[0]
        targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
        ws_url = next(t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page")

        page = Page(ws_url)
        page.call("Emulation.setDeviceMetricsOverride",
                  width=width, height=height, deviceScaleFactor=scale, mobile=mobile)
        page.call("Page.enable")
        page.call("Page.navigate", url=BASE_URL + args.route)
        if not wait_until_ready(page):
            # 偶尔有文件没加载到导致页面空白：重新加载一次再等
            print("页面 20 秒内没有加载完，重新加载一次…", file=sys.stderr)
            page.call("Page.reload", ignoreCache=True)
            if not wait_until_ready(page):
                print("提醒：重新加载后页面仍未完全加载，下面的截图可能不完整", file=sys.stderr)

        params = {"format": "png"}
        if args.full:
            content_height = page.evaluate("document.documentElement.scrollHeight")
            params["clip"] = {"x": 0, "y": 0, "width": width, "height": content_height, "scale": 1}
            params["captureBeyondViewport"] = True
        shot = page.call("Page.captureScreenshot", **params)
        with open(args.output, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        print(f"已保存 {args.output}（{'电脑' if args.desktop else '手机'} {width}×{height}）")
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=5)
        except subprocess.TimeoutExpired:
            chrome.kill()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
