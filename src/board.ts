import type { AppliedOperation, BoardState } from '../shared/protocol';

export function applyRemoteOperation(state: BoardState, event: AppliedOperation): BoardState {
  if (event.version <= state.version) return state;
  const next = structuredClone(state);
  const operation = event.operation;

  switch (operation.type) {
    case 'block:create':
      next.blocks.push({ ...operation.block, updatedAt: event.serverTime });
      break;
    case 'block:update': {
      const block = next.blocks.find((item) => item.id === operation.id);
      if (block) Object.assign(block, operation.patch, { updatedAt: event.serverTime });
      break;
    }
    case 'block:delete':
      next.blocks = next.blocks.filter((item) => item.id !== operation.id);
      next.connections = next.connections.filter((edge) => edge.fromId !== operation.id && edge.toId !== operation.id);
      break;
    case 'connection:create':
      next.connections.push({ ...operation.connection, updatedAt: event.serverTime });
      break;
    case 'connection:delete':
      next.connections = next.connections.filter((edge) => edge.id !== operation.id);
      break;
  }
  next.version = event.version;
  return next;
}

export function blockCenter(block: { x: number; y: number; width: number; height: number }) {
  return { x: block.x + block.width / 2, y: block.y + block.height / 2 };
}
