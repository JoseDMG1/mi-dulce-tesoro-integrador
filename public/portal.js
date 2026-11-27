import { aprobar, bitacora, claves, csv, decision, guardarRonda, muestras, soles } from './dominio.js';

const el = id => document.getElementById(id);
const numero = n => n === null ? 'Sin dato' : new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n);
const leer = (clave, valor) => JSON.parse(localStorage.getItem(clave) || JSON.stringify(valor));
const historial = [];
let borrador, cierreActual;
let solicitudLectura = 0;

async function api(ruta, body) {
  const opciones = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
  const res = await fetch(ruta, { ...opciones, signal: AbortSignal.timeout(18000) });
  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error || 'No se pudo completar la operación.');
  return datos;
}

function estado(id, texto, alerta = false) {
  el(id).textContent = texto;
  el(id).classList.toggle('alerta', alerta);
}

async function cargarLectura() {
  const id = ++solicitudLectura;
  el('actualizar').disabled = true;
  try {
    const r = await api('/api/iot?turno=' + el('turno').value);
    if (id !== solicitudLectura) return;
    el('fuente').textContent = r.fuente;
    el('temperatura').textContent = numero(r.temperatura) + (r.temperatura === null ? '' : ' °C');
    el('humedad').textContent = numero(r.humedad) + (r.humedad === null ? '' : ' %');
    estado('decision', r.decision, r.decision !== 'Cerrar sin incidencia');
    el('lectura-detalle').textContent = 'Regla de práctica: inspeccionar si se supera 28 °C o 65 % HR.' +
      (r.consultado ? ' Consulta: ' + new Date(r.consultado).toLocaleTimeString('es-PE') + '.' : '') +
      (typeof r.movimiento === 'boolean' ? ' Movimiento: ' + (r.movimiento ? 'detectado.' : 'sin detectar.') : '');
  } catch (error) {
    if (id !== solicitudLectura) return;
    for (const id of ['temperatura', 'humedad']) el(id).textContent = '—';
    el('fuente').textContent = 'Lectura no disponible';
    el('lectura-detalle').textContent = 'Selecciona una muestra didáctica para continuar.';
    estado('decision', error.message, true);
  } finally {
    if (id === solicitudLectura) el('actualizar').disabled = false;
  }
}

function mensaje(texto, clase, origen) {
  const item = document.createElement('p');
  item.className = 'mensaje ' + clase;
  item.textContent = texto;
  if (origen) {
    const nota = document.createElement('small');
    nota.textContent = origen;
    item.append(nota);
  }
  el('mensajes').append(item);
  el('mensajes').scrollTop = el('mensajes').scrollHeight;
}

async function chat(pregunta) {
  if (!pregunta || el('chat').querySelector('button').disabled) return;
  const controles = [...el('chat').elements, ...document.querySelectorAll('[data-pregunta]')];
  controles.forEach(item => { item.disabled = true; });
  mensaje(pregunta, 'usuario');
  const espera = document.createElement('p');
  espera.className = 'mensaje asistencia';
  espera.textContent = 'Consultando…';
  el('mensajes').append(espera);
  el('mensajes').scrollTop = el('mensajes').scrollHeight;
  try {
    const r = await api('/api/chat', { pregunta, turno: el('turno').value, historial: historial.slice(-4).map(m => ({ ...m, content: m.content.slice(0, 700) })) });
    historial.push({ role: 'user', content: pregunta }, { role: 'assistant', content: r.respuesta });
    if (historial.length > 6) historial.splice(0, historial.length - 6);
    mensaje(r.respuesta, 'asistencia', r.origen + (r.aviso ? ' · ' + r.aviso : ''));
  } catch (error) {
    mensaje(error.message, 'asistencia');
  } finally {
    espera.remove();
    controles.forEach(item => { item.disabled = false; });
    el('pregunta').focus();
  }
}

function muestraCierre(documento, aprobado) {
  const { resumen, analisis, origen, aviso, observacion } = documento;
  el('detalle-cierre').hidden = false;
  el('titulo-borrador').textContent = (aprobado ? 'Cierre aprobado · ' : 'Borrador · ') + resumen.mes;
  el('datos-borrador').textContent = 'Ventas ' + soles(resumen.ingreso) + ' · Gastos ' + soles(resumen.egreso) +
      ' · Saldo ' + soles(resumen.saldo) + ' · ' + resumen.tickets + ' tickets';
  el('texto-borrador').textContent = analisis;
  el('origen-borrador').textContent = origen + (aviso ? ' · ' + aviso : '') + (observacion ? ' · Revisión: ' + observacion : '');
  el('revisar').hidden = aprobado;
  el('descargar').hidden = !aprobado;
  el('observacion').value = '';
}

function cargarCierre() {
  const guardado = leer(claves.cierres, {})[el('mes').value];
  if (guardado) {
    cierreActual = guardado;
    muestraCierre(guardado, true);
    estado('estado-cierre', 'El período ya tiene un cierre aprobado. Puedes descargar el CSV.');
  } else {
    cierreActual = borrador = undefined;
    el('detalle-cierre').hidden = true;
    estado('estado-cierre', 'El CSV estará disponible después de la aprobación.');
  }
}

el('generar').addEventListener('submit', async event => {
  event.preventDefault();
  const mes = el('mes').value;
  const caso = el('caso').value;
  const controles = [...event.target.elements];
  controles.forEach(item => { item.disabled = true; });
  el('detalle-cierre').hidden = true;
  borrador = cierreActual = undefined;
  estado('estado-cierre', 'Validando registros y preparando el análisis…');
  try {
    if (leer(claves.cierres, {})[mes]) {
      cargarCierre();
      estado('estado-cierre', 'Se evitó un cierre duplicado. El CSV aprobado sigue disponible.', true);
      return;
    }
    const resumen = await api('/api/borrador?' + new URLSearchParams({ mes, caso }));
    const r = await api('/api/chat', { pregunta: 'Redacta un análisis breve del cierre mensual de marzo.', tipo: 'borrador' });
    borrador = { resumen, analisis: r.respuesta, origen: r.origen, aviso: r.aviso };
    muestraCierre(borrador, false);
    estado('estado-cierre', 'Borrador listo para revisión.');
  } catch (error) {
    estado('estado-cierre', error.message, true);
  } finally {
    controles.forEach(item => { item.disabled = false; });
  }
});

el('revisar').addEventListener('submit', async event => {
  event.preventDefault();
  el('aprobar').disabled = true;
  const observacion = el('observacion').value;
  const seleccionado = borrador;
  try {
    const guardar = () => {
      const cierres = leer(claves.cierres, {});
      const registro = aprobar(cierres, seleccionado, observacion);
      localStorage.setItem(claves.cierres, JSON.stringify({ ...cierres, [registro.resumen.mes]: registro }));
      return registro;
    };
    cierreActual = await (navigator.locks ? navigator.locks.request(claves.cierres, guardar) : guardar());
    muestraCierre(cierreActual, true);
    estado('estado-cierre', 'Cierre aprobado. Ya puedes descargar el CSV.');
  } catch (error) {
    estado('estado-cierre', error.message, true);
  } finally {
    el('aprobar').disabled = false;
  }
});

el('rechazar').onclick = () => {
  if (!el('observacion').value.trim()) {
    estado('estado-cierre', 'Registra una observación para rechazar el borrador.', true);
    el('observacion').focus();
    return;
  }
  borrador = cierreActual = undefined;
  el('detalle-cierre').hidden = true;
  estado('estado-cierre', 'Borrador rechazado. No se generó el CSV. Puedes preparar otro.');
};
el('descargar').onclick = () => {
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv(cierreActual)], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'cierre-' + cierreActual.resumen.mes + '.csv';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function muestraBitacora() {
  const lista = el('bitacora');
  const rondas = leer(claves.bitacora, []);
  lista.replaceChildren();
  for (const r of rondas) {
    const fila = document.createElement('li');
    fila.textContent = r.turno + ' · ' + numero(r.temperatura) + ' °C · ' + numero(r.humedad) +
      ' % HR · ' + r.decision + ' · Intentos: ' + r.intentos + ' · ' + r.modo;
    lista.append(fila);
  }
  if (!rondas.length) {
    const fila = document.createElement('li');
    fila.textContent = 'Aún no hay rondas firmadas.';
    lista.append(fila);
  }
}

function guia() {
  let paso = 0, turno, intentos = 0;
  const pruebas = new Set();
  function pantalla(titulo, texto, acciones) {
    el('paso').textContent = titulo;
    el('instruccion').textContent = texto;
    el('opciones').replaceChildren();
    for (const [nombre, accion] of acciones) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'borde';
      boton.textContent = nombre;
      boton.onclick = accion;
      el('opciones').append(boton);
    }
    el('opciones').firstElementChild?.focus();
  }
  const avanzar = () => { paso++; mostrar(); };
  function mostrar(aviso = '') {
    const m = muestras[turno];
    if (paso === 0) return pantalla('Mostrador · 1 de 5', 'Elige el turno que vas a inspeccionar.',
      Object.entries(muestras).map(([id, d]) => [d.nombre + ' · ' + d.hora, () => { turno = id; avanzar(); }]));
    if (paso === 1) return pantalla('Banco DHT11 · 2 de 5', 'Ensaya ambas variables. Banco: ' +
      (pruebas.has('Calentador') ? '30 °C' : '24 °C') + ' · ' + (pruebas.has('Humidificador') ? '72 % HR.' : '55 % HR.') + ' ' + aviso,
    [...['Calentador', 'Humidificador'].map(prueba => [prueba, () => { pruebas.add(prueba); mostrar(); }]),
      ['Guardar prueba', () => pruebas.size === 2 ? avanzar() : mostrar('Completa ambos ensayos.')]]);
    if (paso === 2) return pantalla('Almacén · 3 de 5', m.nombre + ' · ' + numero(m.temperatura) + ' °C · ' + numero(m.humedad) + ' % HR.',
      [['Registrar muestra', avanzar]]);
    if (paso === 3) return pantalla('Recepción · 4 de 5', 'Llegaron dos cajas de café y una de insumos. ' + aviso,
      [2, 3, 4].map(n => [n + ' cajas', () => n === 3 ? avanzar() : mostrar('Revisa el conteo.')]));
    if (paso === 4) return pantalla('Administración · 5 de 5', numero(m.temperatura) + ' °C y ' + numero(m.humedad) +
      ' % HR. Inspecciona si se supera 28 °C o 65 % HR. ' + aviso,
    ['Cerrar sin incidencia', 'Solicitar inspección'].map(nombre => [nombre, () => {
      intentos++;
      if (nombre !== decision(m.temperatura, m.humedad)) return mostrar('Revisa la regla y vuelve a decidir.');
      guardarRonda(bitacora(turno, intentos, 'Recorrido guiado'));
      muestraBitacora();
      avanzar();
    }]));
    pantalla('Bitácora firmada', 'Tu decisión quedó registrada en la bitácora de práctica.', [['Cerrar recorrido', () => {
      el('guia').hidden = true;
      el('iniciar-guia').focus();
    }]]);
  }
  el('guia').hidden = false;
  mostrar();
}

el('turno').onchange = cargarLectura;
el('actualizar').onclick = cargarLectura;
el('mes').onchange = cargarCierre;
el('caso').onchange = cargarCierre;
el('iniciar-guia').onclick = guia;
el('chat').onsubmit = event => {
  event.preventDefault();
  const pregunta = el('pregunta').value.trim();
  el('pregunta').value = '';
  chat(pregunta);
};
for (const boton of document.querySelectorAll('[data-pregunta]')) boton.onclick = () => chat(boton.dataset.pregunta);
window.addEventListener('pageshow', muestraBitacora);
window.addEventListener('storage', event => {
  if (event.key === claves.bitacora) muestraBitacora();
  if (event.key === claves.cierres) cargarCierre();
});
cargarCierre();
muestraBitacora();
cargarLectura();
api('/api/resumen').then(r => {
  el('ventas').textContent = soles(r.ingreso);
  el('gastos').textContent = soles(r.egreso);
  el('saldo').textContent = soles(r.saldo);
  el('tickets').textContent = r.tickets + ' tickets · ' + r.lineas + ' líneas de venta';
}).catch(error => { el('tickets').textContent = error.message; });
api('/api/estado').then(r => {
  el('modo-ia').textContent = r.deepseek ? 'DeepSeek configurado' : 'Respuesta local';
  el('turno').querySelector('[value="sensor"]').hidden = !r.sensor;
  el('sala').hidden = !r.sala;
}).catch(() => { el('modo-ia').textContent = 'Estado no disponible'; });
