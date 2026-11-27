export const periodo = '2026-03';
export const muestras = {
  apertura: { nombre: 'Apertura', hora: '08:00', temperatura: 24.1, humedad: 58 },
  tarde: { nombre: 'Tarde', hora: '15:00', temperatura: 29.4, humedad: 71 }
};
export const claves = { cierres: 'mdt-cierres-v1', bitacora: 'mdt-bitacora-v1' };

export function decision(temperatura, humedad) {
  if (!Number.isFinite(temperatura) || !Number.isFinite(humedad)) return 'Lectura incompleta';
  return temperatura > 28 || humedad > 65 ? 'Solicitar inspección' : 'Cerrar sin incidencia';
}

export function resumen(ventas, gastos, mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Selecciona un período válido.');
  const porMes = filas => filas.filter(fila => fila.fecha.startsWith(mes + '-'));
  const v = porMes(ventas);
  const g = porMes(gastos);
  const idsUnicos = filas => new Set(filas.map(fila => fila.id)).size === filas.length;
  const importe = n => Number.isSafeInteger(n) && n >= 0;
  if (!idsUnicos(v) || !idsUnicos(g) ||
      v.some(fila => !Number.isSafeInteger(fila.cantidad) || fila.cantidad <= 0 ||
        !importe(fila.precio_centimos) || !importe(fila.total_centimos) ||
        fila.cantidad * fila.precio_centimos !== fila.total_centimos) ||
      g.some(fila => !importe(fila.monto_centimos))) throw new Error('Los registros del período tienen importes inválidos o identificadores duplicados.');
  const ingreso = v.reduce((total, fila) => total + fila.total_centimos, 0);
  const egreso = g.reduce((total, fila) => total + fila.monto_centimos, 0);
  if (!importe(ingreso) || !importe(egreso)) throw new Error('El total del período excede el rango permitido.');
  return { mes, ingreso, egreso, saldo: ingreso - egreso, tickets: new Set(v.map(fila => fila.ticket)).size, lineas: v.length };
}

export const soles = centimos => 'S/ ' + new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(centimos / 100);

export function bitacora(turno, intentos, modo) {
  const { nombre, temperatura, humedad } = muestras[turno];
  const id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  return { id, turno: nombre, temperatura, humedad, decision: decision(temperatura, humedad), intentos, modo, fecha: new Date().toISOString() };
}

export function guardarRonda(registro) {
  const registros = JSON.parse(localStorage.getItem(claves.bitacora) || '[]');
  localStorage.setItem(claves.bitacora, JSON.stringify([registro, ...registros].slice(0, 20)));
}

export function aprobar(cierres, borrador, observacion, fecha = new Date().toISOString()) {
  if (!borrador?.resumen?.lineas) throw new Error('Se requiere un borrador válido con ventas.');
  if (cierres[borrador.resumen.mes]) throw new Error('El período ya tiene un cierre aprobado.');
  if (!observacion.trim()) throw new Error('Registra una observación de revisión.');
  return { ...borrador, observacion: observacion.trim(), fecha };
}

function celda(valor) {
  const texto = String(valor);
  const seguro = typeof valor === 'string' && /^[\s]*[=+@-]|^[\r\t\n]/.test(texto) ? "'" + texto : texto;
  return '"' + seguro.replaceAll('"', '""') + '"';
}

export function csv(cierre) {
  if (!cierre?.fecha) throw new Error('El cierre debe estar aprobado para exportar.');
  const { mes, ingreso, egreso, saldo, tickets } = cierre.resumen;
  return [
    ['periodo', 'ventas_pen', 'gastos_pen', 'saldo_pen', 'tickets', 'origen_borrador', 'analisis', 'observacion', 'fecha_aprobacion'],
    [mes, ingreso / 100, egreso / 100, saldo / 100, tickets, cierre.origen, cierre.analisis, cierre.observacion, cierre.fecha]
  ].map(fila => fila.map(celda).join(',')).join('\r\n') + '\r\n';
}
