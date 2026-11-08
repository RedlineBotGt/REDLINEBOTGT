# Estado del proyecto — REDLINEBOTGT

**Última actualización:** 8 de noviembre de 2026 (panel y worker de mensajes programados)  
**Repositorio:** [RedlineBotGt/REDLINEBOTGT](https://github.com/RedlineBotGt/REDLINEBOTGT)  
**Rama de trabajo:** `main`  
**Servicio Render principal:** `REDLINEBOTGT` — Frankfurt  
**URL:** https://redlinebotgt.onrender.com

> Este documento es el punto de continuidad del proyecto. Actualizarlo cuando se hagan cambios relevantes, pruebas, despliegues o se descubran incidencias. No confundir este bot con WEBLINEGT, Academia Campos ni el servicio suspendido REDLINEBOTGT7.

## 1. Estado operativo conocido

- El bot principal se ejecuta en Render, Frankfurt, desde la rama `main`.
- El servicio Render tiene **Auto Deploy activado** (`autoDeploy=yes`) para commits en `main`. Cada cambio en GitHub puede iniciar un despliegue automáticamente; comprobar el estado del último deploy antes de considerar una versión activa.
- Comando de arranque: `npx tsx Index.ts`.
- Build configurado: `npm install && npx tsx register-commands.ts`.
- El servicio expone `/` y `/health` mediante Express.
- MongoDB se conecta de forma diferida mediante `getEventsCollection()`.
- No desplegar cambios sin autorización expresa. En especial, proteger los eventos que estén en curso o programados para el mismo día.

## 2. Arquitectura principal conocida

- **Runtime:** Node.js + TypeScript.
- **Discord:** discord.js v14; cliente central en `Index.ts`.
- **Persistencia:** MongoDB.
- **Integraciones:** Google Sheets / Google APIs en los módulos correspondientes.
- **Servidor HTTP:** Express, utilizado para comprobación de salud.
- **Comandos:** módulos bajo `commands/`, `dashadmin/` y `dashsheet/`.

### Arranque y sistemas conectados

En `Index.ts`:
- Registra protecciones globales de errores.
- Inicia Express y las rutas de salud.
- Ejecuta una comprobación HTTP de Academia Campos al arrancar y cada 10 minutos, con timeout de 60 segundos y un segundo intento tras 15 segundos.
- Registra comandos slash.
- Centraliza la conexión a MongoDB.
- Inicia el cliente Discord y, al recibir `ready`, activa nickname, bienvenida, avisos, encuestas y el worker de eventos.

**La comprobación de Academia Campos es HTTP, no un mensaje privado ni una integración de susurros de Discord.** En el estado revisado no hay un ping equivalente a WEBLINEGT desde este archivo.

## 3. Sistema de eventos

Archivos principales revisados:
- `dashadmin/eventos/eventosmanager.ts`: construye embeds y botones de las tarjetas.
- `dashadmin/eventos/eventosworker.ts`: publicación programada, recordatorio T-30, promoción de reservas, inicio/cierre y recurrencias.
- `dashadmin/eventos/eventosrsvp.ts`: respuestas de participantes y gestión relacionada.
- `dashadmin/eventos/eventosdb.ts`: operaciones de administración y persistencia.
- `dashadmin/eventos/eventoscreate.ts`: creación/publicación de eventos.

Reglas funcionales conocidas que deben preservarse:
- Máximo de 15 titulares.
- Las reservas se mantienen separadas y se promocionan cuando hay plazas.
- Las respuestas `yes`, `reserve`, `maybe` y `no` conservan sus listas e IDs.
- Los IDs originales de participantes en MongoDB no se sustituyen por nombres.
- Los avisos T-30 de titulares y reservas usan menciones individuales en el contenido del mensaje y `allowedMentions.users`.
- El mensaje inicial de publicación menciona el rol configurado para el evento.
- No alterar promociones, plazas, recordatorios, cierres ni recurrencias al cambiar únicamente la presentación del embed.

## 4. Cambio de presentación de menciones — 8/11/2026

### Antecedente

El commit `287f523fde111e55607c9a08288feba28e6e0dd9` añadió resolución de nombres porque algunos participantes aparecían como IDs. La función pasó a sustituir las menciones por texto plano cuando encontraba un nombre. Esto eliminó el aspecto visual de mención que tenían anteriormente las listas del embed.

### Solución aplicada en esta actualización

En `dashadmin/eventos/eventosmanager.ts`:
- Se conserva la búsqueda del miembro en caché y, si hace falta, mediante `guild.members.fetch(id)`.
- Se conserva la búsqueda global del usuario como último recurso para recuperar un nombre si ya no pertenece al servidor.
- Si el participante es miembro del servidor, el embed vuelve a usar el formato nativo `<@ID>`.
- Si ya no pertenece al servidor pero se pudo recuperar su nombre, se muestra `**@Nombre**` como fallback visual.
- Si Discord no permite recuperar ni miembro ni nombre, se conserva `<@ID>` como último recurso.
- No se modifican datos de RSVP, roles, plazas, avisos ni programación.

**Comportamiento esperado:** los miembros actuales deben volver a verse con el formato de mención de Discord dentro de los campos del embed. Las menciones escritas dentro de un embed no deben tratarse como avisos individuales; el aviso al grupo continúa dependiendo de la mención del rol en el contenido del mensaje.

## 5. Pruebas y límites

- Se hizo una comprobación estática de la nueva lógica y una compilación TypeScript aislada de `eventosmanager.ts` usando declaraciones locales mínimas de discord.js: **superada**.
- No se pudo ejecutar una compilación integral del repositorio con sus dependencias reales en este entorno.
- No se ha realizado una prueba visual en un servidor Discord real.
- No se ha desplegado en Render. La versión activa del bot no cambia hasta un despliegue manual.

### Prueba pendiente en Discord

Después de autorizar y realizar un despliegue controlado:
1. Abrir una tarjeta de evento con varios participantes conocidos.
2. Comprobar que los nombres aparecen como menciones visuales dentro de Titulares, Reservas, Duda y No puedo.
3. Confirmar que la publicación no genera notificaciones individuales adicionales.
4. Confirmar que la mención del rol sigue avisando al grupo como antes.
5. Comprobar que un participante que ya no está en el servidor aparece con el fallback `@Nombre` en negrita.
6. Probar una respuesta RSVP y verificar que la tarjeta se actualiza sin alterar listas ni plazas.

Si Discord no representa correctamente las menciones dentro del embed, revertir únicamente el cambio de presentación en `eventosmanager.ts`, sin deshacer los demás arreglos del sistema de eventos.

## 6. Fecha visible en eventos recurrentes — 8/11/2026

### Incidencia detectada

La recurrencia avanzaba correctamente la fecha interna `scheduledAt` sumando `intervalMs`, pero mantenía el campo de texto `date` con la fecha original. Como el embed utiliza `ev.date`, las siguientes publicaciones podían mostrar la fecha inicial aunque la ejecución estuviera programada para otra semana.

### Corrección aplicada

Archivos:
- `dashadmin/eventos/eventosutils.ts`: nueva función `formatMadridDate(date)`, que devuelve `DD/MM/YYYY` usando explícitamente la zona horaria `Europe/Madrid`.
- `dashadmin/eventos/eventosworker.ts`: al cerrar una edición y programar la siguiente, guarda también `date: formatMadridDate(nextScheduledAt)`.

Se mantiene intacta la lógica existente de recurrencia: intervalo, `scheduledAt`, `publishAt`, contador de envíos, estado, reinicio de RSVP, recordatorios, roles y promociones. El embed de cada repetición tomará la nueva fecha del documento y la mostrará automáticamente.

**Ejemplo:** con 6 envíos totales y un intervalo de 7 días, las tarjetas mostrarán la fecha inicial y, después, +7, +14, +21, +28 y +35 días. El total incluye la primera publicación.

### Verificación y despliegue

- Revisión estática del flujo de recurrencia y del campo utilizado por el embed: realizada.
- Compilación integral y prueba en Discord real: pendientes.
- Render: **sin desplegar**; el cambio solo estará activo tras un despliegue manual autorizado.
- No se ha modificado ningún documento de evento ya guardado directamente en MongoDB. La nueva fecha se actualizará cuando el worker cierre el evento actual y programe la siguiente repetición.

## 7. Riesgos y tareas pendientes

- En una revisión anterior se detectaron credenciales sensibles incluidas en el repositorio público (incluyendo un archivo de credenciales y copias de claves/URI en código). **No consta que se hayan rotado o revocado.** Prioridad de seguridad: rotar credenciales expuestas y después retirar los secretos del historial/repositorio de forma controlada. Nunca copiar secretos a este documento.
- Revisar la salud real del bot: actualmente `/health` puede responder aunque el cliente Discord no haya conectado.
- Revisar el manejo de `uncaughtException`: el proceso registra el error, pero no fuerza una salida controlada.
- Verificar en ejecución la ruta de estado de Academia Campos antes de dar por garantizado que el ping la mantiene activa.
- No implementar un ping a WEBLINEGT sin decisión expresa.

## 8. Normas de trabajo

- Revisar el estado actual de GitHub antes de editar.
- Mantener cambios acotados y explicar exactamente qué archivos se modifican.
- No tocar funciones ajenas al objetivo solicitado.
- No desplegar automáticamente ni asumir que un commit está activo en Render.
- Proteger eventos programados o en curso.
- Después de cada cambio, actualizar este documento con commit, archivos, pruebas, despliegue y pendientes.
- Si una prueba falla, revertir solo el cambio concreto cuando sea posible y dejar constancia.

## 9. Último punto de trabajo

**Último cambio:** corrección de la fecha visible de las publicaciones recurrentes. El worker actualiza el campo `date` al programar la siguiente edición, formateándolo en la zona horaria de Madrid. También se conserva la corrección de presentación de menciones descrita en la sección 4.

**Estado:** cambios guardados en GitHub; revisión estática realizada; compilación integral y prueba real en Discord pendientes; Render sin desplegar.


## 10. Mensajes programados: panel de edición y worker — 8/11/2026

### Cambios guardados en GitHub

Archivos modificados:
- `Index.ts`: importa e inicia `startScheduledWorker(client)` al recibir `ready`, junto al worker de eventos.
- `dashadmin/scheduled/interactionscheduled.ts`: el historial ordena los registros más recientes primero y permite seleccionar un registro para consultar/editar. El menú muestra hasta 25 registros más recientes por vista.
- `dashadmin/scheduled/interactionscheduledactions.ts`: incorpora detalle del registro y edición de mensajes pendientes:
  - Texto, imagen, fecha y hora (zona horaria Madrid).
  - Canal de destino.
  - Rol mencionado o quitar la mención.
  - Intervalo en días/horas y número de envíos restantes.
  - Los registros con estado distinto de `pending` son consultables y borrables, pero no editables.
  - Las actualizaciones filtran por `_id`, servidor y `status: 'pending'` para no sobrescribir un mensaje que ya haya cambiado de estado.
  - Validación estricta de fecha real y hora.
- `dashadmin/scheduled/scheduledworker.ts`: reclama cada trabajo pendiente mediante cambio atómico a `processing`, evitando que dos ciclos/instancias reclamen el mismo documento simultáneamente; procesa hasta 25 vencidos por ciclo; al repetir actualiza `scheduledAt`, `date` y `time` en hora de Madrid y conserva correctamente el contador de envíos restantes, incluidos documentos antiguos sin `remainingTimes`.

### Seguridad operativa y límites

- El usuario indicó que eliminará los mensajes pendientes antiguos y creará mensajes nuevos para probar. No se ha accedido ni modificado la colección MongoDB desde estos cambios.
- El worker consulta cada 60 segundos y también realiza un primer ciclo al arrancar.
- Un trabajo pasa temporalmente a `processing`; si el proceso cae y permanece en ese estado más de 10 minutos, vuelve a `pending`. Como con cualquier envío a Discord, si el proceso cae justo después de que Discord acepte el mensaje pero antes de confirmar MongoDB, una recuperación posterior podría repetir ese envío; no existe garantía de entrega exactamente una vez con el flujo actual.
- El historial presenta los 25 registros más recientes. Si hay más de 25, el panel informa de ello; la paginación adicional queda pendiente.
- Se retiró el fallback de URI MongoDB incrustado en los dos módulos de mensajes programados: estos módulos requieren una de las variables de entorno Mongo ya admitidas por el proyecto.

### Commits de esta intervención

- `7248e70`: arranque del worker desde `Index.ts`.
- `5f7f237`: worker con reclamación y actualización de recurrencias.
- `cd720bb`, `14a64e7`, `243e562`, `bec85de`: flujo de edición y validación.
- `ee3fecdf`: historial consultable.
- `4991c0b`: contador compatible con documentos antiguos.

### Pruebas y despliegue

- Revisión estática de los archivos modificados: realizada.
- Compilación TypeScript integral: pendiente de confirmar mediante el build de Render.
- Prueba funcional en Discord: pendiente; requiere crear un mensaje futuro de prueba y verificar edición, envío y recurrencia.
- Render tiene Auto Deploy activo. Los commits ya generaron despliegues automáticos; el último estado consultado estaba en cola/en actualización, por lo que no se considera todavía verificado en producción.
