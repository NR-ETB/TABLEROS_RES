"""Serve a compiled Pages build locally, with request logs for payload checks."""
import argparse
import json
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class PagesHandler(SimpleHTTPRequestHandler):
    fault = ''

    def do_GET(self):
        if (self.fault == 'overview' and self.path.endswith('/overview.json')) or (self.fault == 'detail' and self.path.endswith('/dashboard.json')) or (self.fault == 'worker' and '/analysis.worker-' in self.path):
            self.send_error(503, 'Simulated unavailable resource')
            return
        if self.fault == 'hash' and self.path.endswith('/dashboard.json'):
            data = json.loads(Path('frontend/dist/data/dashboard.json').read_text(encoding='utf-8'))
            data['meta']['dataHash'] = 'simulated-different-cutoff'
            encoded = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        super().do_GET()

    def translate_path(self, path):
        if path.startswith('/TABLEROS_RES/'):
            path = path[len('/TABLEROS_RES'):]
        return super().translate_path(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4180)
    parser.add_argument('--fault', choices=['overview', 'detail', 'hash', 'worker'], default='')
    args = parser.parse_args()
    PagesHandler.fault = args.fault
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(PagesHandler, directory='frontend/dist'))
    print(f'Preview: http://localhost:{args.port}/TABLEROS_RES/', flush=True)
    server.serve_forever()
