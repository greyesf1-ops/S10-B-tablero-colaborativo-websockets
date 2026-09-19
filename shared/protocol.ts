export type Participant = {
  id: string;
  name: string;
  color: string;
};

export type Block = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  updatedAt: number;
};

export type Connection = {
  id: string;
  fromId: string;
  toId: string;
  updatedAt: number;
};

export type BoardState = {
  roomId: string;
  version: number;
  blocks: Block[];
  connections: Connection[];
  participants: Participant[];
};

export type BoardOperation =
  | { type: 'block:create'; block: Omit<Block, 'updatedAt'> }
  | { type: 'block:update'; id: string; patch: Partial<Pick<Block, 'x' | 'y' | 'label' | 'color'>> }
  | { type: 'block:delete'; id: string }
  | { type: 'connection:create'; connection: Omit<Connection, 'updatedAt'> }
  | { type: 'connection:delete'; id: string };

export type AppliedOperation = {
  operation: BoardOperation;
  version: number;
  serverTime: number;
  actorId: string;
};

export type ClientToServerEvents = {
  'room:join': (
    payload: { roomId: string; name: string },
    ack: (result: { ok: true; self: Participant } | { ok: false; message: string }) => void,
  ) => void;
  'cursor:move': (payload: { x: number; y: number }) => void;
  'board:operation': (
    payload: BoardOperation,
    ack: (result: { ok: true; version: number } | { ok: false; message: string }) => void,
  ) => void;
};

export type ServerToClientEvents = {
  'state:sync': (state: BoardState) => void;
  'presence:joined': (participant: Participant) => void;
  'presence:left': (payload: { participantId: string }) => void;
  'cursor:moved': (payload: { participantId: string; x: number; y: number }) => void;
  'board:applied': (payload: AppliedOperation) => void;
  'server:error': (payload: { message: string }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  roomId?: string;
  participant?: Participant;
  ready: boolean;
};
