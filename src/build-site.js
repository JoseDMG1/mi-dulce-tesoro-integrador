import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { build } from 'esbuild';

const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8' };
const assets = Object.fromEntries(readdirSync('public', { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && tipos[extname(entry.name)])
  .map(entry => {
    const path = join(entry.parentPath, entry.name);
    return ['/' + relative('public', path), { type: tipos[extname(entry.name)], data: readFileSync(path).toString('base64') }];
  }));

await build({
  stdin: { contents: `
    import { api, json } from './src/api.js';
    import ventas from './public/datos/ventas.json';
    import gastos from './public/datos/gastos.json';
    import ventas_vacias from './public/datos/ventas_vacias.json';
    import ventas_invalidas from './public/datos/ventas_invalidas.json';
    const assets = ${JSON.stringify(assets)};
    const handle = api({ ventas, gastos, ventas_vacias, ventas_invalidas });
    export default {
      async fetch(request, env) {
        const { pathname, search } = new URL(request.url);
        if (pathname === '/ronda') return new Response(null, { status: 308, headers: { Location: '/ronda/' + search } });
        if (['GET', 'HEAD'].includes(request.method)) {
          const asset = assets[pathname === '/' ? '/index.html' : pathname === '/ronda/' ? '/ronda/index.html' : pathname];
          if (asset) return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.data), byte => byte.charCodeAt(0)), {
            headers: { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff' }
          });
        }
        try { return await handle(request, env) || json({ error: 'Página no encontrada.' }, 404); }
        catch { return json({ error: 'No se pudo completar la solicitud.' }, 500); }
      }
    };
  `, resolveDir: process.cwd(), sourcefile: 'site-worker.js' },
  bundle: true, format: 'esm', platform: 'browser', outfile: 'dist/server/index.js', logLevel: 'info'
});

if (existsSync('.openai/hosting.json')) {
  mkdirSync('dist/.openai', { recursive: true });
  copyFileSync('.openai/hosting.json', 'dist/.openai/hosting.json');
}
