import { io } from 'socket.io-client';
import assert from 'node:assert/strict';

const url = process.env.TEST_URL ?? 'http://localhost:3001';

function once(socket, event, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo agotado esperando ${event}`)), timeout);
    socket.once(event, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

async function client(name, roomId) {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  await once(socket, 'connect');
  const synced = once(socket, 'state:sync');
  const joined = new Promise((resolve) => socket.emit('room:join', { name, roomId }, resolve));
  const [state, result] = await Promise.all([synced, joined]);
  assert.equal(result.ok, true);
  return { socket, state, self: result.self };
}

function operation(socket, value) {
  return new Promise((resolve) => socket.emit('board:operation', value, resolve));
}

const roomA = `integracion-${Date.now()}`;
const roomB = `${roomA}-b`;
const ana = await client('Ana', roomA);
const blockId = 'bloque-prueba';
const appliedForAna = once(ana.socket, 'board:applied');
const createResult = await operation(ana.socket, {
  type: 'block:create',
  block: { id: blockId, x: 40, y: 80, width: 160, height: 76, label: 'Compartido', color: '#7C5CFC' },
});
assert.equal(createResult.ok, true);
assert.equal((await appliedForAna).operation.type, 'block:create');

const bruno = await client('Bruno', roomA);
assert.equal(bruno.state.blocks.length, 1, 'la incorporación tardía debe recibir el bloque');
assert.equal(bruno.state.participants.length, 2, 'ambos participantes deben estar presentes');

const beta = await client('Carla', roomB);
assert.equal(beta.state.blocks.length, 0, 'otra sala debe permanecer aislada');
assert.equal(beta.state.participants.length, 1);

const left = once(bruno.socket, 'presence:left');
ana.socket.disconnect();
assert.equal((await left).participantId, ana.self.id, 'la presencia se retira al desconectar');

const anaReconnected = await client('Ana', roomA);
assert.equal(anaReconnected.state.blocks[0].label, 'Compartido', 'la reconexión recupera el estado vigente');

for (const item of [bruno, beta, anaReconnected]) item.socket.disconnect();
console.log('Integración WebSocket verificada: tiempo real, incorporación tardía, aislamiento y reconexión.');
