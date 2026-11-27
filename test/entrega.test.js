import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { api } from '../src/api.js';
import { room } from '../src/room.js';
import { aprobar, csv, decision, periodo } from '../public/dominio.js';

const datos = Object.fromEntries(['ventas', 'gastos', 'ventas_vacias', 'ventas_invalidas'].map(caso =>
  [caso, JSON.parse(readFileSync(new URL('../public/datos/' + caso + '.json', import.meta.url), 'utf8'))]));
const consulta = path => new Request('http://test.local' + path);
const post = (path, payload, headers = {}) => new Request('http://test.local' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload)
});
const handle = api(datos);

test('tablero y borrador concuerdan en ventas, gastos, saldo y tickets', async () => {
  const tablero = await (await handle(consulta('/api/resumen'))).json();
  assert.deepEqual(tablero, { mes: periodo, ingreso: 11300, egreso: 3500, saldo: 7800, tickets: 4, lineas: 5 });
  assert.deepEqual(await (await handle(consulta('/api/borrador'))).json(), tablero);
});

test('detiene cierres vacíos, inválidos y con un período sin registros', async () => {
  for (const query of ['caso=vacio', 'caso=invalido', 'mes=2026-04']) {
    assert.equal((await handle(consulta('/api/borrador?' + query))).status, 422);
  }
});

test('el CSV requiere aprobación con observación y el período no puede duplicarse', async () => {
  const resumen = await (await handle(consulta('/api/resumen'))).json();
  const borrador = { resumen, origen: 'Reglas del prototipo', analisis: 'Ventas del mes' };
  assert.throws(() => csv(borrador), /aprobado/);
  assert.throws(() => aprobar({}, borrador, ''), /observación/);
  const cierre = aprobar({}, borrador, '=REVISADO', '2026-11-27T00:00:00Z');
  assert.throws(() => aprobar({ [periodo]: cierre }, borrador, 'Segunda revisión'), /aprobado/);
  assert.match(csv(cierre), /"2026-03","113","35","78","4"/);
  assert.match(csv(cierre), /"'=REVISADO"/);
});

test('apertura, tarde y límites coinciden con la regla de la ronda', async () => {
  const apertura = await (await handle(consulta('/api/iot'))).json();
  const tarde = await (await handle(consulta('/api/iot?turno=tarde'))).json();
  assert.deepEqual([apertura.fuente, apertura.temperatura, apertura.humedad, apertura.decision], ['Muestra didáctica', 24.1, 58, 'Cerrar sin incidencia']);
  assert.deepEqual([tarde.temperatura, tarde.humedad, tarde.decision], [29.4, 71, 'Solicitar inspección']);
  assert.equal(decision(28, 65), 'Cerrar sin incidencia');
  assert.equal(decision(28, 65.1), 'Solicitar inspección');
  assert.equal(decision(null, 65), 'Lectura incompleta');
});

test('adaptador ESP32 usa /datos y conserva lectura ausente', async () => {
  const sensor = api(datos, { fetcher: async url => {
    assert.equal(url.href, 'http://sensor.local/datos');
    return Response.json({ temperatura: null, humedad: 72, movimiento: false });
  } });
  const path = consulta('/api/iot?turno=sensor');
  assert.equal((await sensor(path)).status, 503);
  const result = await (await sensor(path, { ESP32_URL: 'http://sensor.local' })).json();
  assert.equal(result.fuente, 'ESP32 · consulta HTTP');
  assert.equal(result.decision, 'Lectura incompleta');
});

test('chat local explica procedencia y decisión y rechaza solicitudes inválidas', async () => {
  const payload = { pregunta: '¿Qué indica la lectura del almacén?', turno: 'tarde' };
  const result = await (await handle(post('/api/chat', payload))).json();
  assert.equal(result.origen, 'Reglas del prototipo');
  assert.match(result.respuesta, /29\.4 °C y 71 % HR.*Solicitar inspección/);
  assert.equal((await handle(post('/api/chat', { pregunta: ' ' }))).status, 400);
  assert.equal((await handle(post('/api/chat', payload, { Origin: 'https://otra-web.local' }))).status, 403);
});

test('DeepSeek recibe el prompt con datos del servidor y degrada ante un fallo', async () => {
  const proveedor = api(datos, { fetcher: async (url, req) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(req.redirect, 'manual');
    assert.equal(req.headers.Authorization, 'Bearer clave-ficticia-de-prueba');
    const { model, messages } = JSON.parse(req.body);
    assert.equal(model, 'deepseek-flash');
    assert.match(messages[0].content, /S\/ 113\.00/);
    assert.equal(messages.at(-1).content, 'Resume marzo.');
    return Response.json({ choices: [{ message: { content: 'Resumen de prueba.' } }] });
  } });
  const env = { DEEPSEEK_API_KEY: 'clave-ficticia-de-prueba' };
  const payload = { pregunta: 'Resume marzo.' };
  assert.deepEqual(await (await proveedor(post('/api/chat', payload), env)).json(), { respuesta: 'Resumen de prueba.', origen: 'DeepSeek' });
  const degradado = api(datos, { fetcher: async () => Response.json({}, { status: 429 }) });
  const result = await (await degradado(post('/api/chat', payload), env)).json();
  assert.equal(result.origen, 'Reglas del prototipo');
  assert.match(result.aviso, /DeepSeek no está disponible/);
});

test('dos usuarios se ven en la sala y comparten la llamada de mesa', async () => {
  const hosted = api(datos, { sala: room() });
  const send = async (ruta, body) => (await hosted(post(ruta, body))).json();
  const primero = await send('/join', { name: 'Participante A', avatar: 'Hombre' });
  const segundo = await send('/join', { name: 'Participante B', avatar: 'Mujer' });
  await send('/service', { token: primero.token, called: true });
  await send('/sync', { token: primero.token, progress: 4 });
  const estado = await send('/sync', { token: segundo.token });
  assert.equal(estado.players.length, 2);
  assert.equal(estado.players.find(p => p.id === primero.id).progress, 4);
  assert.deepEqual(estado.service, { called: true, by: 'Participante A' });
  assert.deepEqual(await send('/leave', { token: primero.token }), { ok: true });
});

test('el servidor entrega el portal y la ronda y protege el archivo local de entorno', async t => {
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const child = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', PUBLIC_ORIGIN: '' },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  t.after(() => child.kill());
  const [salida] = await once(child.stdout, 'data');
  const puerto = /puerto (\d+)/.exec(salida.toString())[1];
  const sitio = 'http://127.0.0.1:' + puerto;
  for (const ruta of ['/', '/portal.css', '/portal.js', '/ronda/', '/ronda/lib/three.min.js', '/health']) {
    assert.equal((await fetch(sitio + ruta)).status, 200, ruta);
  }
  assert.equal((await fetch(sitio + '/.env')).status, 404);
});
