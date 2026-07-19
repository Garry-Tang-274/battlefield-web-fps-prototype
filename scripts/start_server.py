"""启动双语本地服务器。 / Start a bilingual local server."""
from __future__ import annotations

import http.server
import socket
import socketserver
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def find_port(start: int = 8000, end: int = 8100) -> int:
    """寻找可用端口。 / Find an available port."""
    for port in range(start, end + 1):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError("未找到可用端口。 / No available port was found.")


def main() -> None:
    """运行服务器并打开浏览器。 / Run the server and open the browser."""
    port = find_port()
    handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *args, directory=str(ROOT), **kwargs
    )
    url = f"http://127.0.0.1:{port}/"
    print(f"游戏地址 / Game URL: {url}")
    print("按 Ctrl+C 停止服务器。 / Press Ctrl+C to stop the server.")
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    with socketserver.TCPServer(("127.0.0.1", port), handler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n服务器已停止。 / Server stopped.")


if __name__ == "__main__":
    main()
