import { describe, expect, it } from 'vitest';
import type { BoardState } from '../shared/protocol';
import { applyRemoteOperation, blockCenter } from './board';

const base: BoardState = {
  roomId: 'demo', version: 0, participants: [], connections: [],
  blocks: [{ id: 'a', x: 10, y: 20, width: 100, height: 60, label: 'A', color: '#000000', updatedAt: 0 }],
};

describe('sincronización del tablero', () => {
  it('aplica cambios en orden de versión', () => {
    const result = applyRemoteOperation(base, {
      operation: { type: 'block:update', id: 'a', patch: { label: 'Nuevo' } },
      version: 1, serverTime: 25, actorId: 'usuario',
    });
    expect(result.blocks[0].label).toBe('Nuevo');
    expect(result.version).toBe(1);
  });

  it('ignora eventos repetidos', () => {
    const current = { ...base, version: 3 };
    expect(applyRemoteOperation(current, {
      operation: { type: 'block:delete', id: 'a' }, version: 2, serverTime: 20, actorId: 'usuario',
    })).toBe(current);
  });

  it('calcula el centro para conservar las conexiones al mover', () => {
    expect(blockCenter(base.blocks[0])).toEqual({ x: 60, y: 50 });
  });
});
