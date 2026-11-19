// Serves design/ for the Phase D comps and forwards /pms/* to a running preview proxy
// (tools/preview.mjs), so comps show the real library while the token stays in that proxy.
//
//   node tools/preview.mjs &                        # note its port
//   PREVIEW=http://localhost:8361 node design/serve.mjs
import { createServer, request } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const preview = new URL(process.env.PREVIEW || 'http://localhost:8361');
const port = Number(process.env.PORT) || 8399;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/pms/')) {
    const up = request({ host: preview.hostname, port: preview.port, path: req.url, method: req.method, headers: { accept: req.headers.accept || '*/*' } }, r => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    up.on('error', e => { res.statusCode = 502; res.end(String(e)); });
    req.pipe(up);
    return;
  }
  const file = path.join(dir, url.pathname === '/' ? 'comps/index.html' : decodeURIComponent(url.pathname));
  let ok = false;
  try { ok = file.startsWith(dir + path.sep) && statSync(file).isFile(); } catch (e) { /* missing */ }
  if (!ok) { res.statusCode = 404; res.end('not found'); return; }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`design comps on http://localhost:${port}  (Plex via ${preview.origin}/pms)`));
