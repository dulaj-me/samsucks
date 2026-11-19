// Desktop preview with real library data and no sign-in:
//  - serves app/ with caching off,
//  - serves js/config.js as a dev build whose Plex server is this proxy's /pms,
//  - proxies /pms/* to PLEX_SERVER_URL and adds PLEX_TOKEN on the way out,
//  - answers plex.tv calls from tools/fixtures/plextv.json under /plextv, so Plex Home
//    profiles work without a real account: four profiles, Robin's PIN is 1234, and
//    Visitor can't reach this server. Every profile still sees PLEX_TOKEN's library.
// The token stays in this process: the page never sees it, and responses are scrubbed of it.
//
//   node tools/preview.mjs                          # port derived from the checkout path
//   PORT=8124 ENV_FILE=../samsucks/.env node tools/preview.mjs
//   DEV_HOST=localhost:8790 node tools/preview.mjs  # also log to and take commands from devserver.mjs
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'app');
const envFile = path.resolve(process.env.ENV_FILE || path.join(root, '.env'));

const env = {};
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
if (!env.PLEX_SERVER_URL || !env.PLEX_TOKEN) {
  console.error(`PLEX_SERVER_URL and PLEX_TOKEN must be set in ${envFile}`);
  process.exit(1);
}
const upstream = new URL(env.PLEX_SERVER_URL);
const token = env.PLEX_TOKEN;

// One origin per checkout, so parallel worktrees neither collide nor share localStorage.
const port = Number(process.env.PORT) ||
  8200 + [...root].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 700;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function configJs() {
  return readFileSync(path.join(appDir, 'js/config.js'), 'utf8')
    .replace(/^export const DEV = .*$/m, 'export const DEV = true;')
    .replace(/^export const DEV_HOST = .*$/m, `export const DEV_HOST = '${process.env.DEV_HOST || ''}';`)
    .replace(/^export const DEV_PLEX_URL = .*$/m, "export const DEV_PLEX_URL = '/pms';") +
    "export const DEV_PLEX_TV = '/plextv';\n";
}

const tv = JSON.parse(readFileSync(path.join(root, 'tools/fixtures/plextv.json'), 'utf8'));
const profilePrefix = 'fixture-profile-';

function plexTv(req, res, url) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  const auth = req.headers['x-plex-token'] || url.searchParams.get('X-Plex-Token');
  if (!auth) return send(401, tv.unauthorized);
  const p = url.pathname.slice('/plextv'.length);
  if (req.method === 'GET' && p === '/api/v2/user') return send(200, tv.user);
  if (req.method === 'GET' && p === '/api/v2/home/users') return send(200, tv.homeUsers);
  const sw = req.method === 'POST' && p.match(/^\/api\/v2\/home\/users\/([^/]+)\/switch$/);
  if (sw) {
    const u = tv.homeUsers.users.find(x => x.uuid === decodeURIComponent(sw[1]));
    if (!u) return send(404, { errors: [{ code: 1002, message: 'Not found', status: 404 }] });
    if (u.protected && url.searchParams.get('pin') !== tv.pin) return send(403, tv.invalidPin);
    return send(201, Object.assign({}, tv.user, {
      id: u.id, uuid: u.uuid, title: u.title, username: u.username, email: u.email, thumb: u.thumb,
      protected: u.protected, restricted: u.restricted, homeAdmin: u.admin, authToken: profilePrefix + u.uuid,
    }));
  }
  if (req.method === 'GET' && p === '/api/v2/resources') {
    const who = auth.startsWith(profilePrefix) ? auth.slice(profilePrefix.length) : 'account';
    const blocked = tv.noAccess.includes(who);
    return send(200, tv.resources
      .filter(r => r.provides !== 'server' || (r.clientIdentifier === 'lan-dev') !== blocked)
      .map(r => Object.assign({}, r, { accessToken: r.provides === 'server' ? 'fixture-server-' + who : '' })));
  }
  send(404, { errors: [{ code: 1002, message: 'No fixture for ' + req.method + ' ' + p, status: 404 }] });
}

function serveStatic(req, res, pathname) {
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/js/config.js') {
    res.setHeader('Content-Type', TYPES['.js']);
    res.end(configJs());
    return;
  }
  const file = path.join(appDir, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
  let stat = null;
  try { if (file.startsWith(appDir + path.sep)) stat = statSync(file); } catch (e) { /* missing */ }
  if (!stat || !stat.isFile()) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  createReadStream(file).pipe(res);
}

const DROP_REQ = ['host', 'origin', 'referer', 'cookie', 'connection', 'accept-encoding', 'x-plex-token'];
const DROP_RES = ['connection', 'transfer-encoding', 'keep-alive'];
const isText = type => /json|xml|text|mpegurl/i.test(type || '');

function proxy(req, res, rest) {
  const target = new URL(rest, upstream);
  // "//host/x" or "/\host/x" would resolve to another host and carry the token there.
  if (target.origin !== upstream.origin) {
    res.statusCode = 400;
    res.end('bad path');
    return;
  }
  // delete() re-encodes the whole query, so only touch it when there's something to remove.
  if (target.searchParams.has('X-Plex-Token')) target.searchParams.delete('X-Plex-Token');
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!DROP_REQ.includes(k)) headers[k] = v;
  headers['x-plex-token'] = token;

  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const up = send(target, { method: req.method, headers }, upRes => {
    const type = upRes.headers['content-type'];
    for (const [k, v] of Object.entries(upRes.headers)) {
      if (DROP_RES.includes(k)) continue;
      if (k === 'content-length' && isText(type)) continue;
      res.setHeader(k, k === 'location' ? String(v).split(token).join('') : v);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = upRes.statusCode;
    if (upRes.statusCode >= 400) console.warn(upRes.statusCode, req.method, target.pathname);
    if (!isText(type)) { upRes.pipe(res); return; }
    const chunks = [];
    upRes.on('data', c => chunks.push(c));
    upRes.on('end', () => res.end(Buffer.concat(chunks).toString('utf8').split(token).join('')));
  });
  up.on('error', e => {
    console.warn('upstream error', req.method, target.pathname, e.code || e.message);
    if (!res.headersSent) res.statusCode = 502;
    res.end();
  });
  req.pipe(up);
}

// Only the preview's own pages may use the token: blocks DNS rebinding and cross-site requests.
const selves = [`localhost:${port}`, `127.0.0.1:${port}`];

createServer((req, res) => {
  const origin = req.headers.origin;
  if (!selves.includes(req.headers.host) || (origin && !selves.some(s => origin === 'http://' + s))) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/pms' || url.pathname.startsWith('/pms/')) {
      proxy(req, res, req.url.slice(4) || '/');
    } else if (url.pathname.startsWith('/plextv/')) {
      plexTv(req, res, url);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (e) {
    if (!res.headersSent) res.statusCode = 400;
    res.end('bad request');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`preview on http://localhost:${port}  (Plex via /pms, env from ${path.relative(process.cwd(), envFile) || envFile})`);
});
