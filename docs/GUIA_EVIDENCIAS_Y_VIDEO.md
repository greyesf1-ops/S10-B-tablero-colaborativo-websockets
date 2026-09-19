# Guía de evidencias y video

Los archivos de evidencia se guardan fuera del repositorio o en `evidencias/`, `video/` y `entrega/`, rutas ignoradas por Git.

## Datos sugeridos

- Sala principal: `arquitectura-10b`
- Sala aislada: `privada-10b`
- Participantes: Ana, Bruno y Carla
- Bloques: `Cliente React`, `Servidor WebSocket`, `Estado por sala`

## Capturas para el PDF

1. **Dos clientes simultáneos:** coloque dos ventanas lado a lado en `arquitectura-10b`. Muestre la lista de Ana y Bruno, dos punteros y el mismo diagrama con al menos tres bloques y dos conexiones.
2. **Incorporación tardía:** con el diagrama ya construido, abra una ventana privada como Carla, ingrese a `arquitectura-10b` y capture el tablero ya poblado junto a los tres participantes.
3. **Aislamiento:** abra `privada-10b` y muestre que no contiene los bloques de la sala principal. Idealmente coloque ambas salas lado a lado.
4. **Reconexión:** si se desea evidencia adicional, desconecte la red o reinicie solamente el cliente, espere el mensaje de sincronización y capture el estado recuperado.

Antes de cada captura, cierre herramientas de desarrollo, notificaciones y datos personales visibles.

## Guion de video (máximo 3 minutos)

| Tiempo | Acción | Narración sugerida |
|---|---|---|
| 0:00-0:20 | Abrir dos clientes y entrar a la misma sala. | “Ana crea la sala y Bruno se une mediante el identificador. Ambos aparecen con nombre y color.” |
| 0:20-0:40 | Mover ambos punteros. | “Las posiciones se envían como eventos efímeros; no se retransmite el tablero completo.” |
| 0:40-1:15 | Crear tres bloques, editar una etiqueta y mover dos bloques. | “El servidor valida, ordena y difunde cada operación con una versión creciente.” |
| 1:15-1:35 | Conectar dos pares de bloques y mover uno. | “Las conexiones conservan los identificadores de sus extremos y se recalculan al moverlos.” |
| 1:35-1:55 | Abrir a Carla después de los cambios. | “El tercer cliente recibe `state:sync` y comienza con el estado vigente.” |
| 1:55-2:15 | Mostrar una sala distinta vacía. | “Las emisiones y el estado se aíslan por identificador de sala.” |
| 2:15-2:40 | Cerrar un cliente y observar que desaparece; volver a abrirlo. | “La desconexión retira la presencia. Al reconectar se bloquea la edición hasta recuperar el estado.” |
| 2:40-2:55 | Mostrar indicador conectado y versión. | “Socket.IO usa únicamente transporte WebSocket y el servidor aplica último cambio aceptado.” |

## Lista de verificación

- El video dura menos de 3:00.
- Se observan dos usuarios simultáneos y sus punteros.
- Se crea, mueve, edita y elimina al menos un bloque.
- Se crea una conexión y se demuestra que sigue al bloque.
- Se demuestra incorporación tardía.
- Se demuestra desconexión y reconexión.
- Se demuestra aislamiento entre salas.
- El enlace del video tiene permiso de lectura.
- El archivo del video no está dentro del repositorio Git.
