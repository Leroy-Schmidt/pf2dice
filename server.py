"""Dev-only static server with caching disabled.

Plain `python -m http.server` lets the browser cache ES modules, which makes
live verification pick up stale code. This subclass sends `Cache-Control: no-store`
so every reload fetches fresh files. Not part of the deployed app (GitHub Pages
serves the static files directly).

Usage: python server.py [port]
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
