import { describe, expect, it } from 'vitest';
import { RoomStore } from './state.js';

describe('RoomStore autoritativo', () => {
  it('mantiene las salas aisladas y sincroniza incorporaciones tardías', () => {
    const store = new RoomStore();
    store.apply('alpha', { type: 'block:create', block: { id: 'uno', x: 0, y: 0, width: 120, height: 70, label: 'Alpha', color: '#7C5CFC' } }, 1);
    expect(store.snapshot('alpha').blocks).toHaveLength(1);
    expect(store.snapshot('beta').blocks).toHaveLength(0);
  });

  it('elimina las conexiones asociadas al eliminar un bloque', () => {
    const store = new RoomStore();
    store.apply('alpha', { type: 'block:create', block: { id: 'a', x: 0, y: 0, width: 120, height: 70, label: 'A', color: '#7C5CFC' } });
    store.apply('alpha', { type: 'block:create', block: { id: 'b', x: 200, y: 0, width: 120, height: 70, label: 'B', color: '#1CB9A8' } });
    store.apply('alpha', { type: 'connection:create', connection: { id: 'ab', fromId: 'a', toId: 'b' } });
    store.apply('alpha', { type: 'block:delete', id: 'a' });
    expect(store.snapshot('alpha').connections).toHaveLength(0);
  });
});
