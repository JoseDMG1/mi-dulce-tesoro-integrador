import { createServer } from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { api, json } from './api.js';
import { room } from './room.js';

const root = new URL('../public/', import.meta.url);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };
const assets = new Map(readdirSync(root, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && types[extname(entry.name)])
  .map(entry => {
    const path = join(entry.parentPath, entry.name);
    return ['/' + relative(fileURLToPath(root), path), { type: types[extname(entry.name)], body: readFileSync(path) }];
  }));
assets.set('/', assets.get('/index.html'));
assets.set('/ronda/', assets.get('/ronda/index.html'));
const datos = Object.fromEntries(['ventas', 'gastos', 'ventas_vacias', 'ventas_invalidas'].map(name =>
  [name, JSON.parse(readFileSync(new URL('datos/' + name + '.json', root), 'utf8'))]));
const handle = api(datos, { sala: room() });
const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] === 'https' && req.socket.remoteAddress === '127.0.0.1' ? 'https://' : 'http://';
    const origin = process.env.PUBLIC_ORIGIN || protocol + host;
    const url = new URL(req.url, origin);
    if (url.pathname === '/ronda') {
      res.writeHead(308, { Location: '/ronda/' + url.search });
      return res.end();
    }
    const isRead = ['GET', 'HEAD'].includes(req.method);
    const asset = isRead ? assets.get(url.pathname) : null;
    if (asset) {
      res.writeHead(200, { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Content-Length': asset.body.length });
      return res.end(req.method === 'HEAD' ? undefined : asset.body);
    }
    const init = { method: req.method, headers: req.headers };
    if (!isRead) Object.assign(init, { body: Readable.toWeb(req), duplex: 'half' });
    const request = new Request(url, init);
    const response = await handle(request, process.env) || json({ error: 'Página no encontrada.' }, 404);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"No se pudo completar la solicitud."}');
  }
});
server.listen(Number(process.env.PORT || 4188), process.env.HOST || '0.0.0.0', () => {
  console.log('Mi Dulce Tesoro · puerto ' + server.address().port);
});
