import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '../shared/protocol.js';
import { cursorSchema, joinSchema, operationSchema, RoomStore } from './state.js';

const colors = ['#7C5CFC', '#1CB9A8', '#FF8A4C', '#EF5DA8', '#3B82F6', '#EAB308'];
const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  transports: ['websocket'],
  cors: { origin: true, credentials: true },
});
const store = new RoomStore();

app.get('/api/health', (_request, response) => response.json({ ok: true, transport: 'websocket' }));

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = existsSync(path.resolve(process.cwd(), 'dist'))
  ? path.resolve(process.cwd(), 'dist')
  : path.resolve(here, '../dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_request, response) => response.sendFile(path.join(clientDist, 'index.html')));
}

io.on('connection', (socket) => {
  socket.data.ready = false;

  socket.on('room:join', async (raw, ack) => {
    const parsed = joinSchema.safeParse(raw);
    if (!parsed.success) {
      ack({ ok: false, message: 'Nombre o identificador de sala inválido' });
      return;
    }

    const { roomId, name } = parsed.data;
    if (socket.data.roomId) {
      store.removeParticipant(socket.data.roomId, socket.id);
      await socket.leave(socket.data.roomId);
    }

    const room = store.getOrCreate(roomId);
    const participant = {
      id: socket.id,
      name,
      color: colors[room.participants.length % colors.length],
    };

    socket.data.roomId = roomId;
    socket.data.participant = participant;
    socket.data.ready = false;
    await socket.join(roomId);
    store.addParticipant(roomId, participant);

    socket.emit('state:sync', store.snapshot(roomId));
    socket.data.ready = true;
    socket.to(roomId).emit('presence:joined', participant);
    ack({ ok: true, self: participant });
  });

  socket.on('cursor:move', (raw) => {
    const parsed = cursorSchema.safeParse(raw);
    const { roomId, participant, ready } = socket.data;
    if (!parsed.success || !roomId || !participant || !ready) return;
    socket.to(roomId).emit('cursor:moved', { participantId: participant.id, ...parsed.data });
  });

  socket.on('board:operation', (raw, ack) => {
    const parsed = operationSchema.safeParse(raw);
    const { roomId, participant, ready } = socket.data;
    if (!parsed.success || !roomId || !participant || !ready) {
      ack({ ok: false, message: 'Operación inválida o cliente sin sincronizar' });
      return;
    }

    try {
      const serverTime = Date.now();
      const version = store.apply(roomId, parsed.data, serverTime);
      io.to(roomId).emit('board:applied', {
        operation: parsed.data,
        version,
        serverTime,
        actorId: participant.id,
      });
      ack({ ok: true, version });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo aplicar la operación';
      ack({ ok: false, message });
      socket.emit('server:error', { message });
    }
  });

  socket.on('disconnect', () => {
    const { roomId, participant } = socket.data;
    if (!roomId || !participant) return;
    store.removeParticipant(roomId, participant.id);
    socket.to(roomId).emit('presence:left', { participantId: participant.id });
  });
});

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => {
  console.log(`NexoBoard listo en http://localhost:${port}`);
});

export { httpServer, io, store };
