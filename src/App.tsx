import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  BoardOperation,
  BoardState,
  ClientToServerEvents,
  Participant,
  ServerToClientEvents,
} from '../shared/protocol';
import { applyRemoteOperation, blockCenter } from './board';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type Cursor = { participantId: string; x: number; y: number };
type Tool = 'select' | 'block' | 'connect';
type EditorState = { mode: 'create' | 'edit'; value: string; blockId?: string } | null;

const emptyState: BoardState = { roomId: '', version: 0, blocks: [], connections: [], participants: [] };

function makeRoomId() {
  return `sala-${Math.random().toString(36).slice(2, 8)}`;
}

export function App() {
  const [name, setName] = useState(() => sessionStorage.getItem('nexoboard:name') ?? '');
  const [roomInput, setRoomInput] = useState(() => new URLSearchParams(location.search).get('sala') ?? makeRoomId());
  const [room, setRoom] = useState<BoardState>(emptyState);
  const [self, setSelf] = useState<Participant | null>(null);
  const [status, setStatus] = useState<'offline' | 'connecting' | 'syncing' | 'online'>('offline');
  const [message, setMessage] = useState('Listo para colaborar');
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const socketRef = useRef<ClientSocket | null>(null);
  const boardRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; lastSent: number } | null>(null);
  const credentialsRef = useRef<{ roomId: string; name: string } | null>(null);

  const participantsById = useMemo(
    () => Object.fromEntries(room.participants.map((participant) => [participant.id, participant])),
    [room.participants],
  );

  useEffect(() => {
    const socket: ClientSocket = io({ autoConnect: false, transports: ['websocket'], reconnection: true });
    socketRef.current = socket;

    const synchronize = () => {
      const credentials = credentialsRef.current;
      if (!credentials) return;
      setStatus('syncing');
      setMessage('Recuperando el estado vigente…');
      socket.emit('room:join', credentials, (result) => {
        if (result.ok) setSelf(result.self);
        else {
          setStatus('offline');
          setMessage(result.message);
        }
      });
    };

    socket.on('connect', synchronize);
    socket.on('disconnect', () => {
      setStatus('connecting');
      setMessage('Conexión interrumpida. Intentando reconectar…');
    });
    socket.io.on('reconnect_attempt', () => setStatus('connecting'));
    socket.on('state:sync', (snapshot) => {
      setRoom(snapshot);
      setCursors({});
      setStatus('online');
      setMessage('Estado sincronizado');
    });
    socket.on('presence:joined', (participant) => {
      setRoom((current) => ({ ...current, participants: [...current.participants.filter((p) => p.id !== participant.id), participant] }));
      setMessage(`${participant.name} se unió a la sala`);
    });
    socket.on('presence:left', ({ participantId }) => {
      setRoom((current) => ({ ...current, participants: current.participants.filter((p) => p.id !== participantId) }));
      setCursors((current) => {
        const next = { ...current };
        delete next[participantId];
        return next;
      });
    });
    socket.on('cursor:moved', (cursor) => setCursors((current) => ({ ...current, [cursor.participantId]: cursor })));
    socket.on('board:applied', (event) => setRoom((current) => applyRemoteOperation(current, event)));
    socket.on('server:error', ({ message: serverMessage }) => setMessage(serverMessage));
    socket.on('connect_error', () => {
      setStatus('connecting');
      setMessage('No se pudo conectar con el servidor');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function join(event: FormEvent) {
    event.preventDefault();
    const cleanedName = name.trim();
    const cleanedRoom = roomInput.trim().toLowerCase();
    if (cleanedName.length < 2 || cleanedRoom.length < 3) {
      setMessage('Escribe un nombre y una sala válidos');
      return;
    }
    sessionStorage.setItem('nexoboard:name', cleanedName);
    history.replaceState(null, '', `?sala=${encodeURIComponent(cleanedRoom)}`);
    credentialsRef.current = { roomId: cleanedRoom, name: cleanedName };
    setStatus('connecting');
    setMessage('Conectando con la sala…');
    const socket = socketRef.current!;
    if (socket.connected) {
      setStatus('syncing');
      socket.emit('room:join', credentialsRef.current, (result) => {
        if (result.ok) setSelf(result.self);
        else setMessage(result.message);
      });
    } else socket.connect();
  }

  function leave() {
    socketRef.current?.disconnect();
    credentialsRef.current = null;
    setSelf(null);
    setRoom(emptyState);
    setStatus('offline');
    setMessage('Saliste de la sala');
  }

  function send(operation: BoardOperation) {
    if (status !== 'online') {
      setMessage('Espera a que termine la sincronización');
      return;
    }
    socketRef.current?.emit('board:operation', operation, (result) => {
      if (!result.ok) setMessage(result.message);
    });
  }

  function pointFromEvent(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = boardRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onBoardPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (status !== 'online') return;
    const point = pointFromEvent(event);
    socketRef.current?.volatile.emit('cursor:move', point);
    const drag = dragRef.current;
    if (!drag) return;
    const now = performance.now();
    if (now - drag.lastSent < 35) return;
    drag.lastSent = now;
    send({ type: 'block:update', id: drag.id, patch: { x: point.x - drag.offsetX, y: point.y - drag.offsetY } });
  }

  function addBlock() {
    setEditor({ mode: 'create', value: `Bloque ${room.blocks.length + 1}` });
  }

  function handleBlockClick(id: string) {
    setSelectedId(id);
    if (tool !== 'connect') return;
    if (!connectFrom) {
      setConnectFrom(id);
      setMessage('Selecciona el bloque de destino');
    } else if (connectFrom !== id) {
      send({ type: 'connection:create', connection: { id: crypto.randomUUID(), fromId: connectFrom, toId: id } });
      setConnectFrom(null);
      setTool('select');
      setMessage('Conexión creada');
    }
  }

  function startDrag(event: ReactPointerEvent<SVGGElement>, id: string) {
    if (tool !== 'select') return;
    const block = room.blocks.find((item) => item.id === id);
    if (!block) return;
    const point = pointFromEvent(event as unknown as ReactPointerEvent<SVGSVGElement>);
    dragRef.current = { id, offsetX: point.x - block.x, offsetY: point.y - block.y, lastSent: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function editSelected(id = selectedId) {
    const block = room.blocks.find((item) => item.id === id);
    if (!block) return;
    setEditor({ mode: 'edit', value: block.label, blockId: block.id });
  }

  function saveEditor(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const label = editor.value.trim();
    if (!label) return;
    if (editor.mode === 'create') {
      send({
        type: 'block:create',
        block: {
          id: crypto.randomUUID(),
          x: 90 + (room.blocks.length % 4) * 190,
          y: 90 + Math.floor(room.blocks.length / 4) * 130,
          width: 160,
          height: 76,
          label,
          color: self?.color ?? '#7C5CFC',
        },
      });
    } else if (editor.blockId) {
      send({ type: 'block:update', id: editor.blockId, patch: { label } });
    }
    setEditor(null);
    setTool('select');
  }

  function deleteSelected() {
    if (!selectedId) return;
    send({ type: 'block:delete', id: selectedId });
    setSelectedId(null);
  }

  if (!self || !room.roomId) {
    return (
      <main className="welcome-shell">
        <section className="welcome-panel">
          <div className="brand"><span className="brand-mark">N</span><span>NexoBoard</span></div>
          <div className="welcome-copy">
            <p className="eyebrow">ESPACIO DE TRABAJO EN TIEMPO REAL</p>
            <h1>Las ideas fluyen mejor <span>cuando todos están presentes.</span></h1>
            <p>Crea diagramas, conecta conceptos y observa cada cambio al instante.</p>
          </div>
          <form className="join-card" onSubmit={join}>
            <div className="live-pill"><i /> WebSocket listo</div>
            <label>Tu nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Andrea" maxLength={24} /></label>
            <label>Identificador de sala<input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder="equipo-alpha" maxLength={32} /></label>
            <button type="submit">Entrar al tablero <span>→</span></button>
            <button className="ghost" type="button" onClick={() => setRoomInput(makeRoomId())}>Generar otra sala</button>
            <p className={`form-status ${status}`}>{message}</p>
          </form>
        </section>
        <footer>TypeScript · Socket.IO · Estado autoritativo</footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">N</span><span>NexoBoard</span></div>
        <div className="room-meta">
          <span className={`status-dot ${status}`} />
          <div><small>{status === 'online' ? 'CONECTADO' : status === 'syncing' ? 'SINCRONIZANDO' : 'RECONECTANDO'}</small><strong>{room.roomId}</strong></div>
          <button className="copy-button" title="Copiar enlace" onClick={() => navigator.clipboard.writeText(location.href)}>⧉</button>
        </div>
        <button className="leave-button" onClick={leave}>Salir</button>
      </header>

      <aside className="sidebar">
        <div className="sidebar-title"><span>Participantes</span><b>{room.participants.length}</b></div>
        <div className="people">
          {room.participants.map((participant) => (
            <div className="person" key={participant.id}>
              <span className="avatar" style={{ background: participant.color }}>{participant.name.slice(0, 1).toUpperCase()}</span>
              <div><strong>{participant.name}</strong><small>{participant.id === self.id ? 'Tú · editando' : 'En línea'}</small></div>
              <i style={{ background: participant.color }} />
            </div>
          ))}
        </div>
        <div className="sync-note"><span>↻</span><p><strong>Sincronización activa</strong><small>Versión del tablero: {room.version}</small></p></div>
      </aside>

      <section className="workspace">
        <div className="toolbar">
          <button className={tool === 'select' ? 'active' : ''} onClick={() => { setTool('select'); setConnectFrom(null); }} title="Seleccionar">↖</button>
          <button onClick={addBlock} title="Crear bloque">＋</button>
          <button className={tool === 'connect' ? 'active' : ''} onClick={() => setTool('connect')} title="Conectar">↗</button>
          <span />
          <button onClick={() => editSelected()} disabled={!selectedId} title="Editar">✎</button>
          <button onClick={deleteSelected} disabled={!selectedId} title="Eliminar">⌫</button>
        </div>
        <svg
          ref={boardRef}
          className={`board tool-${tool}`}
          onPointerMove={onBoardPointerMove}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerLeave={() => { dragRef.current = null; }}
          onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}
        >
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c7ccda" /></pattern>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#7c8398" /></marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {room.connections.map((connection) => {
            const from = room.blocks.find((block) => block.id === connection.fromId);
            const to = room.blocks.find((block) => block.id === connection.toId);
            if (!from || !to) return null;
            const a = blockCenter(from); const b = blockCenter(to);
            return <line key={connection.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="edge" markerEnd="url(#arrow)" />;
          })}
          {room.blocks.map((block) => (
            <g
              key={block.id}
              className={`block ${selectedId === block.id ? 'selected' : ''} ${connectFrom === block.id ? 'connecting' : ''}`}
              transform={`translate(${block.x} ${block.y})`}
              onPointerDown={(event) => startDrag(event, block.id)}
              onClick={(event) => { event.stopPropagation(); handleBlockClick(block.id); }}
              onDoubleClick={() => { setSelectedId(block.id); editSelected(block.id); }}
            >
              <rect width={block.width} height={block.height} rx="14" fill="white" stroke={block.color} />
              <rect width="7" height={block.height} rx="3.5" fill={block.color} />
              <text x="22" y="34" className="block-label">{block.label}</text>
              <text x="22" y="55" className="block-meta">Actualizado en v{room.version}</text>
            </g>
          ))}
          {Object.values(cursors).map((cursor) => {
            const participant = participantsById[cursor.participantId];
            if (!participant) return null;
            return (
              <g className="remote-cursor" key={cursor.participantId} transform={`translate(${cursor.x} ${cursor.y})`}>
                <path d="M0 0 L3 18 L8 12 L14 17 L17 14 L11 9 L18 6 Z" fill={participant.color} stroke="white" strokeWidth="1.5" />
                <rect x="12" y="17" width={Math.max(54, participant.name.length * 8 + 16)} height="24" rx="7" fill={participant.color} />
                <text x="20" y="34">{participant.name}</text>
              </g>
            );
          })}
        </svg>
        <div className="hint">{tool === 'connect' ? (connectFrom ? 'Ahora selecciona el destino' : 'Selecciona el bloque de origen') : message}</div>
        <div className="legend"><span><i className="purple" /> cambios en tiempo real</span><span><i className="green" /> estado sincronizado</span></div>
      </section>
      {editor && (
        <div className="modal-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
          <form className="editor-modal" onSubmit={saveEditor}>
            <p className="eyebrow">{editor.mode === 'create' ? 'NUEVO ELEMENTO' : 'EDITAR ELEMENTO'}</p>
            <h2>{editor.mode === 'create' ? 'Crear bloque' : 'Cambiar etiqueta'}</h2>
            <label htmlFor="block-label">Etiqueta</label>
            <input
              id="block-label"
              autoFocus
              maxLength={80}
              value={editor.value}
              onChange={(event) => setEditor({ ...editor, value: event.target.value })}
              onKeyDown={(event) => { if (event.key === 'Escape') setEditor(null); }}
            />
            <div className="modal-actions">
              <button type="button" onClick={() => setEditor(null)}>Cancelar</button>
              <button type="submit">{editor.mode === 'create' ? 'Crear bloque' : 'Guardar cambios'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
