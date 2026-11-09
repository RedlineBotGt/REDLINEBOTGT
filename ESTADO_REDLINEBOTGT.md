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

- El usuario indicó que eliminaría los mensajes pendientes antiguos y crearía mensajes nuevos para probar. No se ha accedido ni modificado la colección MongoDB desde estos cambios. Durante el primer despliegue, el worker anterior registró **un envío** a `Archivo RedLineGT` a las 22:33:05 UTC. No aparecen otros envíos del worker en los logs consultados hasta las 22:36 UTC; no fue posible inspeccionar directamente los documentos restantes en MongoDB. Confirmar con el usuario que los registros antiguos se han eliminado antes de crear pruebas.
- El worker consulta cada 60 segundos y también realiza un primer ciclo al arrancar.
- Un trabajo pasa temporalmente a `processing`; si el proceso cae y permanece en ese estado más de 10 minutos, vuelve a `pending`. Como con cualquier envío a Discord, si el proceso cae justo después de que Discord acepte el mensaje pero antes de confirmar MongoDB, una recuperación posterior podría repetir ese envío; no existe garantía de entrega exactamente una vez con el flujo actual.
- El historial presenta los 25 registros más recientes. Si hay más de 25, el panel informa de ello; la paginación adicional queda pendiente.
- Se conserva el fallback de conexión MongoDB que ya existía en estos dos módulos porque Render no tiene configurada ninguna de las variables MongoDB contempladas por el código. No se cambiaron credenciales ni variables de entorno.

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
- Render tiene Auto Deploy activo. Los despliegues de los commits intermedios fallaron primero por una expresión regular con escape incorrecto y después por la ausencia de variables MongoDB en Render; ambas causas se corrigieron/restauraron en commits posteriores. El commit más reciente está en cola/en despliegue; producción aún no se considera verificada.

## 11. Imágenes desde la galería en mensajes oficiales — 8/11/2026

### Funcionalidad aplicada

Se ha añadido la posibilidad de adjuntar una imagen directamente desde el dispositivo en los formularios de mensajes oficiales, tanto desde `/msn` como desde el botón «usr mensaje» de `/dashstaff`.

Comprobación de enrutamiento:
- El comando `/msn` y el formulario del panel utilizan el mismo identificador de modal (`modal_msn_...`).
- El enrutador `handleDashAdminInteractions` deriva ambos envíos a `dashadmin/msn/msnmanager.ts`.
- Por tanto, el gestor común recibe ambos formularios; no se ha duplicado la lógica de envío.

Archivos modificados:
- `package.json`: actualizada la dependencia de `discord.js` de `^14.14.1` a `^14.27.0`, que incluye `FileUploadBuilder`, `LabelBuilder` y `ModalSubmitFields.getUploadedFiles()`.
- `commands/msn.ts`: el modal de `/msn` ahora muestra un selector opcional de una imagen, además del campo de URL existente.
- `dashadmin/msn/msnmanager.ts`: el modal del panel incorpora el mismo selector y el envío procesa el archivo cargado junto con las menciones existentes.
- `handlers/modalImageUpload.ts` (nuevo): descarga el adjunto desde el CDN de Discord y lo prepara para reenviarlo al canal. Comprueba el host HTTPS, el tipo real de imagen, el tamaño máximo de 8 MB y aplica un timeout de descarga de 15 segundos.

Comportamiento:
- Se puede enviar una imagen desde la galería sin pegar ninguna URL.
- El selector admite una imagen como máximo y está marcado como opcional.
- Se conservan el texto, la conversión de menciones, los permisos y el campo de URL.
- Si se rellenan tanto el selector como la URL, se envían ambos adjuntos.
- Se admiten imágenes JPG, PNG, GIF, WEBP y AVIF. Otros tipos se rechazan con un error controlado.

### Commits

- `fc547c7`: helper de descarga segura de imagen.
- `0fa0f7c`: actualización de discord.js.
- `cd47eab`: selector de imagen en `/msn`.
- `259c939`: selector y procesamiento de imagen en el panel/gestor común.
- `7c2e16b`: validación estricta del tipo de imagen.

### Verificación y despliegue

- La revisión del código y del flujo de enrutamiento está realizada.
- La documentación oficial de discord.js 14.27.0 confirma los componentes de carga y el método para recuperar adjuntos de un modal.
- Render completó el despliegue del commit `6bdb4aa56eae6b9a48a7d7a928a82d669dadebe3` en estado **LIVE** el 8/11/2026 a las 22:46 UTC.
- Sigue pendiente la prueba funcional en Discord de los dos accesos (`/msn` y «usr mensaje» de `/dashstaff`), incluida una imagen de galería, una URL y el caso sin imagen. No confundir despliegue LIVE con prueba funcional completada.

## 12. Contador visible de repeticiones pendientes — 8/11/2026

### Cambios aplicados

- `dashadmin/scheduled/interactionscheduled.ts`: el historial general muestra ahora **Repeticiones pendientes** en cada registro, además de canal, fecha, texto y estado.
- `dashadmin/scheduled/interactionscheduledactions.ts`: el detalle individual utiliza la etiqueta **Repeticiones pendientes por enviar** y muestra los envíos realizados.
- Para documentos antiguos sin `remainingTimes`, el panel calcula el saldo con `totalRepetitions - repetitionsDone`. En mensajes únicos muestra 1 si sigue pendiente y 0 si ya se envió.
- `dashadmin/scheduled/scheduledworker.ts`: se corrigió la actualización MongoDB de la recurrencia, que contenía dos propiedades `$set` en el mismo objeto. Ahora fecha, hora, estado y contador se guardan en una única operación `$set`.
- Cuando se realiza el último envío, el contador se establece en 0 y el registro pasa a `sent`. También se actualiza el contador si se completa un mensaje repetido cuyo intervalo resulta inválido.

### Commits

- `225e347`: contador en el historial general.
- `9abe2bf`: corrección del contador y de la actualización del worker.
- `4e16b8d`: etiqueta y cálculo del contador en el detalle individual.

### Verificación pendiente

- Revisar que Render complete el despliegue automático de estos commits.
- Probar en Discord un programado repetido: antes del primer envío debe mostrar el total; tras cada envío debe reducirse; después del último debe mostrar 0 y estado `sent`.
- No se han modificado documentos de MongoDB ni se han enviado mensajes de prueba.

## 13. Corrección real del selector de imágenes — 8/11/2026

### Incidencia confirmada en Render

- A las 22:58:51 UTC y 22:59:00 UTC, al seleccionar canal en «usr mensaje» de /dashstaff, Render registró: TypeError: ...setFileTypes is not a function en dashadmin/msn/msnmanager.ts:70.
- La interacción quedó sin reclamar y el modal no llegó a abrirse. Esto explica que el usuario no viera el selector.
- Discord.js se declara como ^14.27.0. La documentación específica de discord.js 14.27.0 no incluye setFileTypes() en FileUploadBuilder; el método aparece en documentación posterior. No usarlo con la versión actual.

### Correcciones aplicadas

- Quitado setFileTypes('image') de commands/msn.ts y dashadmin/msn/msnmanager.ts.
- El componente queda opcional, con mínimo 0 y máximo 1 archivo. La validación real del tipo MIME, CDN de Discord y tamaño se realiza después en handlers/modalImageUpload.ts.
- commands/msn.ts y el flujo de panel usan el mismo customId/modal; el router del panel procesa el submit y llama a buildModalImageAttachment() para adjuntar la foto al mensaje.
- handlers/msnModal.ts también queda actualizado para procesar el archivo, aunque el flujo principal modal_msn_ se atiende por el gestor de DashAdmin.
- Se conserva la opción de pegar URL.
- Commits: e6f7475 (selector /msn y submit), acf9f3b (selector /dashstaff).

### Estado

- Los cambios se han guardado en main.
- Despliegue automático solicitado a Render; pendiente confirmar LIVE y probar los dos flujos desde Discord.


## 14. Corrección de etiquetas de los modales — 9/11/2026

### Segundo error detectado en producción

- Tras quedar LIVE el commit `9d90c6e`, los logs de Render mostraron un error nuevo al abrir el formulario de `/dashstaff`: DiscordAPIError[50035] / Invalid Form Body.
- Mensaje concreto: `Cannot set label on a TextInput in a Label component`.
- La causa era que los `TextInputBuilder` mantenían `.setLabel()` aunque ya estaban envueltos por `LabelBuilder`. Discord no permite ambas etiquetas a la vez.

### Corrección aplicada

- Eliminado `.setLabel()` de los dos `TextInputBuilder` en `dashadmin/msn/msnmanager.ts`.
- Aplicado lo mismo en `commands/msn.ts` para mantener ambos formularios coherentes.
- Las etiquetas visibles siguen definidas en los `LabelBuilder`; no se elimina el texto que ve el usuario.
- Commits: `7f2fabd` (gestor /dashstaff) y `666935e` (/msn).

### Estado

- Render recibió ambos commits y creó los despliegues automáticos.
- En la última consulta, el despliegue del commit `7f2fabd` estaba construyéndose y el de `666935e` estaba en cola.
- Pendiente confirmar el último despliegue como LIVE, revisar logs posteriores y probar en Discord los dos formularios y la carga de una imagen real.
- No declarar la funcionalidad como verificada hasta completar esa prueba.


## 15. Múltiples imágenes en mensajes oficiales — 9/11/2026

- Se amplió el selector de archivos de `/msn` y `/dashstaff` de 1 a un máximo de 10 imágenes.
- El envío recoge todos los archivos seleccionados, los valida individualmente y los adjunta junto al texto y la URL opcional.
- El helper `handlers/modalImageUpload.ts` ahora prepara una colección de adjuntos, conserva la validación de CDN, MIME y 8 MB por imagen, y asigna nombres únicos a los archivos.
- Commits: `508f485` (helper múltiple), `b772ef5` (gestor /dashstaff), `5def492` (/msn).
- Pendiente: confirmar Render LIVE y probar en Discord varias fotos junto con una URL en ambos formularios. No declarar la prueba funcional completada antes de esa comprobación.


## 16. Traducción de textos largos en /trans — 9/11/2026

### Incidencia
- MyMemory rechazaba las traducciones largas con `QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY: 500 CHARS`.
- El límite procedía del servicio de traducción, no de Discord.

### Cambio aplicado
- `commands/trans.ts`: el texto de entrada admite hasta 6.000 caracteres.
- El comando divide automáticamente el texto en fragmentos de hasta 450 caracteres, priorizando saltos de línea y finales de frase para ajustarse al límite de MyMemory.
- Las consultas se realizan secuencialmente y se unen las traducciones.
- Se protegen durante la traducción las menciones de usuarios/roles/canales, emojis personalizados, enlaces y delimitadores Markdown habituales (`**`, `__`, `~~`, `||` y backticks), restaurándolos después.
- Si el resultado completo supera los 2.000 caracteres de Discord, se entrega en varios mensajes.
- Commit: `1a69cecb66691452e6643f33909b64ca016bbaa7`.

### Verificación pendiente
- Render ha iniciado el despliegue automático del commit `1a69cecb66691452e6643f33909b64ca016bbaa7`; en la última consulta estaba en `build_in_progress`.
- Pendiente confirmar LIVE y probar en Discord un texto largo con emojis, saltos de línea, negritas y menciones reales.
- No declarar la prueba funcional completada hasta que el usuario la confirme.

## 17. Despertador HTTP de WEBLINEGT — 9/11/2026

### Cambio aplicado en `Index.ts`

- Se retiró el despertador HTTP de Academia Campos.
- Se sustituyó por una comprobación HTTP de WEBLINEGT en `https://weblinegt.onrender.com/health`, ruta confirmada en `WEBLINEGT/src/server.ts`.
- Se conserva la frecuencia anterior: primera petición al arrancar y después cada 10 minutos.
- Se conserva el timeout de 60 segundos, el segundo intento tras 15 segundos y la protección para impedir comprobaciones simultáneas.
- La respuesta de `/health` de WEBLINEGT es texto plano (`WEBLINEGT activo`), por lo que ahora se lee como texto y no como JSON.
- Se añade la variable opcional `WEBLINE_HEALTH_URL`; si no está definida, se usa la URL de producción indicada arriba.
- Los mensajes de registro identifican el servicio como `[WEBLINEGT]`.

### Commit y verificación

- Commit de código: `3b2e13c3398b657045af5dfcfd26161ae604845f`.
- Rama: `BOTGT7`.
- Revisión estática: confirmada la ruta `/health` en la rama `WEBLINEGT` y adaptada la lectura a texto plano.
- Pendiente: confirmar el despliegue del bot REDLINE en Render y comprobar en sus logs una respuesta correcta de WEBLINEGT. No se ha realizado una llamada de prueba externa ni se declara todavía que WEBLINEGT permanezca despierta en producción.
- No se han modificado archivos de WEBLINEGT ni de Academia Campos.
