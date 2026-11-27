import { randomUUID } from 'node:crypto';
import { json } from './api.js';

export function room() {
  const sessions = new Map();
  let service = { called: false, by: '' };
  return (path, data) => {
    if (!data || typeof data !== 'object') return json({ error: 'Solicitud inválida.' }, 400);
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (now - session.seen > 30000) sessions.delete(token);
    }
    if (!sessions.size) service = { called: false, by: '' };
    if (path === '/join') {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 20 || !['Hombre', 'Mujer'].includes(data.avatar)) {
        return json({ error: 'Revisa el nombre y el personaje.' }, 400);
      }
      if (sessions.size >= 30) return json({ error: 'La sala está llena.' }, 409);
      const token = randomUUID();
      const player = { id: randomUUID(), name, avatar: data.avatar, x: -2.65, y: 1.62, z: 1.44, yaw: -.4, progress: 0 };
      sessions.set(token, { player, seen: now });
      return json({ token, id: player.id, x: player.x, z: player.z, minZ: -9.3 });
    }

    const session = sessions.get(data.token);
    if (!session) return json({ error: 'Vuelve a entrar a la sala.' }, 410);
    session.seen = now;
    if (path === '/leave') {
      sessions.delete(data.token);
      return json({ ok: true });
    }
    if (path === '/service') {
      if (typeof data.called !== 'boolean') return json({ error: 'Indica el estado de la mesa.' }, 400);
      service = { called: data.called, by: session.player.name };
      return json(service);
    }
    for (const key of ['x', 'y', 'z', 'yaw']) {
      if (Number.isFinite(data[key])) session.player[key] = data[key];
    }
    if (Number.isInteger(data.progress) && data.progress >= 0 && data.progress <= 5) session.player.progress = data.progress;
    return json({ service, players: [...sessions.values()].map(item => item.player) });
  };
}
