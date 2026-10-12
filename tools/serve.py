"""本地预览服务器：和 python3 -m http.server 一样，但告诉浏览器不要缓存，
这样改完代码后，手机和电脑刷新就能拿到最新文件。

用法（在项目根目录运行）：
    python3 tools/serve.py          # 默认端口 8000
    python3 tools/serve.py 8080
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Server(ThreadingHTTPServer):
    # 默认只排队 5 个连接；浏览器打开页面时会同时请求 30 多个文件，排队太短可能丢请求
    request_queue_size = 64
    daemon_threads = True


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=str(ROOT))
    server = Server(("0.0.0.0", port), handler)
    print(f"预览地址：http://localhost:{port}（按 Ctrl+C 停止）")
    server.serve_forever()


if __name__ == "__main__":
    main()
