# start.py — DEV local minimalista (Flask + HTTP estático)
import os
import sys
import threading
import webbrowser
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Config
BACKEND_HOST  = os.getenv("DEV_HOST", "127.0.0.1")
BACKEND_PORT  = int(os.getenv("DEV_PORT", "5000"))
FRONTEND_HOST = os.getenv("DEV_FRONT_HOST", "127.0.0.1")
FRONTEND_PORT = int(os.getenv("DEV_FRONT_PORT", "5500"))
OPEN_BROWSER  = os.getenv("DEV_OPEN_BROWSER", "1") == "1"

# Caminhos fixos
ROOT_DIR     = Path(__file__).parent.resolve()
BACKEND_DIR  = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
ENTRY_FILE   = "index.html"  # já confirmado que existe aqui

def serve_frontend():
    class StaticHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

        def do_GET(self):
            if self.path in ("/", "/index.html"):
                self.path = "/" + ENTRY_FILE
            return super().do_GET()

    httpd = ThreadingHTTPServer((FRONTEND_HOST, FRONTEND_PORT), StaticHandler)

    def _run():
        print(f"[DEV] Frontend: http://{FRONTEND_HOST}:{FRONTEND_PORT}/{ENTRY_FILE}")
        httpd.serve_forever()

    threading.Thread(target=_run, name="frontend-http", daemon=True).start()

def main():
    sys.path.insert(0, str(BACKEND_DIR))

    serve_frontend()

    if OPEN_BROWSER:
        url = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}/{ENTRY_FILE}"
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    from app import app as flask_app
    print(f"[DEV] Backend:  http://{BACKEND_HOST}:{BACKEND_PORT}")
    flask_app.run(host=BACKEND_HOST, port=BACKEND_PORT, debug=True, use_reloader=False)

if __name__ == "__main__":
    main()
