const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

loadEnvFile(path.join(ROOT, '.env'));

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

async function handleTranslate(req, res) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch (_) { /* handled by API */ }

  const apiRes = {
    setHeader: (name, value) => res.setHeader(name, value),
    status: (code) => ({
      json: (value) => sendJson(res, code, value),
      end: () => { res.statusCode = code; res.end(); },
    }),
  };
  await require('./api/translate')({ method: req.method, body }, apiRes);
}

function serveFile(res, pathname) {
  const aliases = { '/': '/index.html', '/admin': '/admin.html' };
  const requestPath = aliases[pathname] || pathname;
  const target = path.resolve(ROOT, `.${decodeURIComponent(requestPath)}`);
  if (!target.startsWith(`${ROOT}${path.sep}`)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(target, (error, content) => {
    if (error) return sendJson(res, error.code === 'ENOENT' ? 404 : 500, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream' });
    res.end(content);
  });
}

http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/api/translate') return handleTranslate(req, res).catch(() => sendJson(res, 500, { error: 'Server error' }));
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
  return serveFile(res, pathname);
}).listen(PORT, () => console.log(`Weeve local server: http://localhost:${PORT}`));
