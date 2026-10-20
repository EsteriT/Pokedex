"""Loopback-only development server; private project files are never served."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PublicHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        port = self.server.server_port
        hosts = {f"localhost:{port}", f"127.0.0.1:{port}"}
        if port == 80:
            hosts.update(("localhost", "127.0.0.1"))
        if self.headers.get("Host") not in hosts:
            self.send_error(403)
            return None
        try:
            parts = Path(self.translate_path(self.path)).resolve().relative_to(ROOT).parts
        except (ValueError, OSError, RuntimeError):
            self.send_error(404)
            return None
        if not parts:
            self.send_response(302)
            self.send_header("Location", "/src/")
            self.end_headers()
            return None
        if parts[0] not in ("src", "assets", "preview") or any(p.startswith(".") for p in parts):
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5500)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    with ThreadingHTTPServer(("127.0.0.1", args.port), PublicHandler) as server:
        print(f"Local Pokedex: http://127.0.0.1:{args.port}/src/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
