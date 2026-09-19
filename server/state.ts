import { z } from 'zod';
import type { BoardOperation, BoardState, Participant } from '../shared/protocol.js';

const id = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const coordinate = z.number().finite().min(-5000).max(5000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const joinSchema = z.object({
  roomId: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/),
  name: z.string().trim().min(2).max(24),
});

export const cursorSchema = z.object({ x: coordinate, y: coordinate });

export const operationSchema: z.ZodType<BoardOperation> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('block:create'),
    block: z.object({
      id,
      x: coordinate,
      y: coordinate,
      width: z.number().finite().min(100).max(420),
      height: z.number().finite().min(60).max(240),
      label: z.string().trim().min(1).max(80),
      color,
    }),
  }),
  z.object({
    type: z.literal('block:update'),
    id,
    patch: z
      .object({ x: coordinate.optional(), y: coordinate.optional(), label: z.string().trim().min(1).max(80).optional(), color: color.optional() })
      .refine((patch) => Object.keys(patch).length > 0, 'El cambio no puede estar vacío'),
  }),
  z.object({ type: z.literal('block:delete'), id }),
  z.object({
    type: z.literal('connection:create'),
    connection: z.object({ id, fromId: id, toId: id }).refine((c) => c.fromId !== c.toId, 'Los bloques deben ser distintos'),
  }),
  z.object({ type: z.literal('connection:delete'), id }),
]);

type Room = BoardState & { participants: Participant[] };

export class RoomStore {
  private readonly rooms = new Map<string, Room>();

  getOrCreate(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { roomId, version: 0, blocks: [], connections: [], participants: [] };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  snapshot(roomId: string): BoardState {
    const room = this.getOrCreate(roomId);
    return structuredClone(room);
  }

  addParticipant(roomId: string, participant: Participant): void {
    const room = this.getOrCreate(roomId);
    room.participants = room.participants.filter((item) => item.id !== participant.id);
    room.participants.push(participant);
  }

  removeParticipant(roomId: string, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.participants = room.participants.filter((item) => item.id !== participantId);
  }

  apply(roomId: string, operation: BoardOperation, serverTime = Date.now()): number {
    const room = this.getOrCreate(roomId);

    switch (operation.type) {
      case 'block:create': {
        if (room.blocks.some((block) => block.id === operation.block.id)) throw new Error('El bloque ya existe');
        room.blocks.push({ ...operation.block, updatedAt: serverTime });
        break;
      }
      case 'block:update': {
        const index = room.blocks.findIndex((block) => block.id === operation.id);
        if (index === -1) throw new Error('El bloque no existe');
        room.blocks[index] = { ...room.blocks[index], ...operation.patch, updatedAt: serverTime };
        break;
      }
      case 'block:delete': {
        if (!room.blocks.some((block) => block.id === operation.id)) throw new Error('El bloque no existe');
        room.blocks = room.blocks.filter((block) => block.id !== operation.id);
        room.connections = room.connections.filter((edge) => edge.fromId !== operation.id && edge.toId !== operation.id);
        break;
      }
      case 'connection:create': {
        const { connection } = operation;
        if (!room.blocks.some((block) => block.id === connection.fromId) || !room.blocks.some((block) => block.id === connection.toId)) {
          throw new Error('Ambos bloques deben existir');
        }
        if (room.connections.some((edge) => edge.id === connection.id)) throw new Error('La conexión ya existe');
        const duplicate = room.connections.some((edge) => edge.fromId === connection.fromId && edge.toId === connection.toId);
        if (duplicate) throw new Error('Esos bloques ya están conectados');
        room.connections.push({ ...connection, updatedAt: serverTime });
        break;
      }
      case 'connection:delete': {
        if (!room.connections.some((edge) => edge.id === operation.id)) throw new Error('La conexión no existe');
        room.connections = room.connections.filter((edge) => edge.id !== operation.id);
        break;
      }
    }

    room.version += 1;
    return room.version;
  }
}
