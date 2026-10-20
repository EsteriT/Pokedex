"""Check public routes and private-file denial without reading private files."""
import http.client
import threading
from http.server import ThreadingHTTPServer
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("local_server", Path(__file__).with_name("serve-local.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
server = ThreadingHTTPServer(("127.0.0.1", 0), module.PublicHandler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()


def request(path, method="GET", host=None):
    connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
    try:
        headers = {"Host": host} if host else {}
        connection.request(method, path, headers=headers)
        response = connection.getresponse()
        data = response.read()
        return response.status, dict(response.getheaders()), data
    finally:
        connection.close()


try:
    status, headers, _ = request("/")
    assert status == 302 and headers["Location"] == "/src/"
    for path in ("/src/", "/src/workspace.html", "/preview/Pokedex-discover.html", "/src/scripts/theme.js"):
        status, headers, data = request(path)
        assert status == 200 and data and headers.get("Cache-Control") == "no-store", path
        if path.endswith(".js"):
            assert "javascript" in headers["Content-type"]
    for path in ("/.env.local", "/.git/config", "/.scratch/README.md", "/package.json", "/scripts/backend-env.cjs", "/src/%2e%2e/.env.local", "/src/.hidden", "/assets/"):
        for method in ("GET", "HEAD"):
            assert request(path, method)[0] == 404, (path, method)
    for host in ("attacker.example", "127.0.0.1.attacker.example", "localhost:1"):
        assert request("/src/", host=host)[0] == 403, host
    assert request("/src/", method="POST")[0] == 501
    print("PASS: loopback development routes, JavaScript MIME, no-store responses, GET/HEAD private-file denial, directory denial and Host protection.")
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)
