import { decision, muestras, periodo, resumen, soles } from '../public/dominio.js';

const prompt = 'Eres Dulce IA, asistente administrativo de una cafetería. Escribe en español. Usa únicamente las cifras y hechos del contexto, conserva sus unidades y distingue telemetría del ESP32 de las muestras didácticas. Si falta información, dilo. No inventes comparaciones, tendencias ni acciones realizadas. Presenta cualquier sugerencia como propuesta humana. Si piden aprobar, modificar o exportar, explica que la interfaz y su responsable realizan esas acciones. Responde en máximo 110 palabras, sin tablas.';
export const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function leerJson(request, permitirBeacon = false) {
  if (!permitirBeacon && !request.headers.get('Content-Type')?.includes('application/json')) throw new Error('Se requiere JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Cuerpo vacío.');
  const decoder = new TextDecoder();
  let texto = '', bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return JSON.parse(texto + decoder.decode());
    bytes += value.byteLength;
    if (bytes > 8192) {
      await reader.cancel();
      throw new Error('Solicitud demasiado grande.');
    }
    texto += decoder.decode(value, { stream: true });
  }
}

export function api(datos, { fetcher = fetch, sala } = {}) {
  const r = resumen(datos.ventas, datos.gastos, periodo);

  async function lectura(turno, env) {
    if (turno !== 'sensor') {
      const muestra = muestras[turno];
      return { ...muestra, decision: decision(muestra.temperatura, muestra.humedad), fuente: 'Muestra didáctica' };
    }
    if (!env.ESP32_URL) return { error: 'Configura ESP32_URL en el servidor para consultar el sensor.' };
    try {
      const url = new URL('/datos', env.ESP32_URL);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      const respuesta = await fetcher(url, { signal: AbortSignal.timeout(3000), redirect: 'manual' });
      if (!respuesta.ok) throw new Error();
      const { temperatura, humedad, movimiento } = await respuesta.json();
      if (!(temperatura === null || Number.isFinite(temperatura)) ||
          !(humedad === null || (Number.isFinite(humedad) && humedad >= 0 && humedad <= 100))) throw new Error();
      return { nombre: 'Almacén', temperatura, humedad, movimiento: typeof movimiento === 'boolean' ? movimiento : null,
        decision: decision(temperatura, humedad), fuente: 'ESP32 · consulta HTTP', consultado: new Date().toISOString() };
    } catch {
      return { error: 'El ESP32 no respondió con una lectura válida. Revisa la conexión del servidor con el sensor.' };
    }
  }

  async function chat(body, env) {
    const pregunta = typeof body.pregunta === 'string' ? body.pregunta.trim() : '';
    const esBorrador = body.tipo === 'borrador';
    if (!pregunta || pregunta.length > 800) return json({ error: 'Escribe una consulta de hasta 800 caracteres.' }, 400);
    const turno = Object.hasOwn(muestras, body.turno) || body.turno === 'sensor' ? body.turno : 'apertura';
    const iot = await lectura(turno, env);
    const cierre = 'En marzo de 2026 se registraron ' + r.tickets + ' tickets, con ventas de ' + soles(r.ingreso) +
      ' y gastos de ' + soles(r.egreso) + '. El saldo del conjunto de demostración es ' + soles(r.saldo) + '.';
    const contexto = iot.error || (iot.fuente + ' · ' + iot.nombre + '. ' +
      (iot.temperatura ?? 'Sin dato') + ' °C y ' + (iot.humedad ?? 'sin dato') + ' % HR. Decisión: ' + iot.decision + '.');
    let respuesta = 'Puedo resumir las ventas, los gastos, el saldo de marzo de 2026 y la lectura ambiental seleccionada.';
    if (esBorrador || /ventas|gastos|saldo|marzo|cierre|resumen|ticket|ingres|egres/i.test(pregunta)) respuesta = cierre;
    if (/temperatura|humedad|lectura|inspecci[oó]n|sensor|almac[eé]n|alerta|origen/i.test(pregunta)) {
      respuesta = respuesta === cierre ? cierre + ' ' + contexto : contexto;
    }
    if (esBorrador) respuesta += ' Revisa los registros antes de aprobar el cierre.';
    if (!env.DEEPSEEK_API_KEY?.trim()) return json({ respuesta, origen: 'Reglas del prototipo' });
    const mensajes = [
      { role: 'system', content: prompt + '\nContexto del prototipo (ventas y gastos ficticios): ' + cierre + '\nRegla didáctica: inspeccionar con más de 28 °C o más de 65 % HR. ' + contexto },
      ...(Array.isArray(body.historial) ? body.historial.slice(-6).filter(m => m &&
        ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.length <= 1400)
        .map(m => ({ role: m.role, content: m.content })) : []),
      { role: 'user', content: pregunta }
    ];
    try {
      const resultado = await fetcher('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY.trim(), 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000), redirect: 'manual',
        body: JSON.stringify({ model: env.DEEPSEEK_MODEL || 'deepseek-flash', messages: mensajes,
          thinking: { type: 'disabled' }, max_tokens: 300 })
      });
      if (!resultado.ok) {
        return json({ respuesta, origen: 'Reglas del prototipo',
          aviso: 'DeepSeek no está disponible en este momento (HTTP ' + resultado.status + ').' });
      }
      const contenido = (await resultado.json()).choices?.[0]?.message?.content?.trim();
      if (!contenido) throw new Error();
      return json({ respuesta: contenido, origen: 'DeepSeek' });
    } catch (error) {
      const motivo = ['TimeoutError', 'AbortError'].includes(error.name) ? 'tiempo de espera agotado' : 'error de conexión o de respuesta';
      return json({ respuesta, origen: 'Reglas del prototipo', aviso: 'DeepSeek no está disponible en este momento (' + motivo + ').' });
    }
  }

  return async function handle(request, env = {}) {
    const { pathname, searchParams } = new URL(request.url);
    if (request.method === 'GET') {
      if (pathname === '/health') return json({ estado: 'ok' });
      if (pathname === '/api/resumen') return json(r);
      if (pathname === '/api/estado') return json({ deepseek: Boolean(env.DEEPSEEK_API_KEY?.trim()), sensor: Boolean(env.ESP32_URL), sala: Boolean(sala) });
      if (pathname === '/api/iot') {
        const turno = searchParams.get('turno') ?? 'apertura';
        if (!Object.hasOwn(muestras, turno) && turno !== 'sensor') return json({ error: 'Turno desconocido.' }, 400);
        const reporte = await lectura(turno, env);
        return json(reporte, reporte.error ? 503 : 200);
      }
      if (pathname === '/api/borrador') {
        const casos = { normal: datos.ventas, vacio: datos.ventas_vacias, invalido: datos.ventas_invalidas };
        const caso = searchParams.get('caso') ?? 'normal';
        if (!Object.hasOwn(casos, caso)) return json({ error: 'Escenario desconocido.' }, 400);
        try {
          const resultado = resumen(casos[caso], datos.gastos, searchParams.get('mes') ?? periodo);
          if (!resultado.lineas) return json({ error: 'El período no tiene ventas. El cierre se detuvo.' }, 422);
          return json(resultado);
        } catch (error) { return json({ error: error.message }, 422); }
      }
    }
    if (request.method === 'POST' && pathname === '/api/chat') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== new URL(request.url).origin && origin !== env.PUBLIC_ORIGIN) return json({ error: 'Origen no autorizado.' }, 403);
      const body = await leerJson(request).catch(() => null);
      return body && typeof body === 'object' ? chat(body, env) : json({ error: 'Consulta inválida.' }, 400);
    }
    if (sala && request.method === 'POST' && ['/join', '/sync', '/leave', '/service'].includes(pathname)) {
      const body = await leerJson(request, pathname === '/leave').catch(() => null);
      return sala(pathname, body);
    }
    if (pathname.startsWith('/api/')) return json({ error: 'Ruta no encontrada.' }, 404);
    return null;
  };
}
