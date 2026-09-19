# Respuestas de reflexión

## 1. ¿Por qué usar WebSockets y no solicitudes HTTP periódicas?

WebSockets mantiene un canal bidireccional abierto. El servidor puede propagar una operación apenas la acepta, sin que cada cliente tenga que consultar repetidamente. Esto reduce latencia y tráfico innecesario, algo especialmente importante para punteros que cambian muchas veces por segundo.

## 2. ¿Cómo recibe el estado un usuario que se incorpora tarde?

Al ejecutar `room:join`, el servidor agrega la presencia y emite `state:sync` con una instantánea vigente de bloques, conexiones, participantes y versión. El socket se marca como listo después de ese envío; por eso no se aceptan interacciones antes de la sincronización inicial.

## 3. ¿Qué ocurre si dos usuarios modifican el mismo bloque?

El servidor procesa y numera las operaciones en el orden en que las acepta. Se utiliza último cambio aceptado por el servidor: la operación con versión mayor define el valor final. Los clientes aplican esa secuencia y descartan versiones repetidas o antiguas.

## 4. ¿Cómo se aíslan las salas?

Cada sala tiene su propio `BoardState` dentro de un `Map`. Al ingresar, Socket.IO asocia el socket con un único `roomId`. Los eventos del tablero, presencia y punteros se emiten exclusivamente a esa sala; además, las operaciones no contienen un identificador de sala manipulable por el cliente.

## 5. ¿Cómo se manejan desconexión y reconexión?

En `disconnect`, el servidor elimina la presencia y emite `presence:left`. Socket.IO intenta reconectar el cliente automáticamente. Tras recuperar el canal, el cliente vuelve a emitir `room:join`, se mantiene en estado `syncing`, recibe una nueva instantánea y solo entonces vuelve a permitir operaciones.

## 6. ¿Qué cambiaría para llevar la solución a producción?

Se agregaría autenticación, autorización por sala, límites de frecuencia, observabilidad y persistencia. Para varias instancias del servidor se usaría un adaptador compartido como Redis y una base de datos o registro de eventos. Si se necesitara edición compleja sin una autoridad central única, se evaluaría CRDT u otra estrategia de resolución de conflictos.
