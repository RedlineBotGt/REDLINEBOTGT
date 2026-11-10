# Estado del proyecto — REDLINEBOTGT

**Última actualización:** 8 de noviembre de 2026 (panel y worker de mensajes programados)  
**Repositorio:** [RedlineBotGt/REDLINEBOTGT](https://github.com/RedlineBotGt/REDLINEBOTGT)  
**Rama de trabajo:** `BOTGT7`  
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


## 18. Adjuntar fotos y vídeos en los reportes — 9/11/2026

### Cambio aplicado en el flujo activo

- Se confirmó que el flujo público de reportes utilizado por el bot pasa por `dashadmin/interactiondashadmin.ts` → `dashadmin/reporte/interactionreporte.ts` → `dashadmin/reporte/reportemodal.ts`.
- No se modificó la copia antigua `handlers/reportModal.ts`, porque no es la ruta activa del panel de reportes.
- El formulario principal conserva sus cinco campos actuales, incluido el enlace opcional.
- Después de enviar el formulario aparece un segundo paso efímero con dos opciones:
  - **Adjuntar fotos / vídeos**: abre un modal con selector de archivos.
  - **Omitir y enviar**: tramita el reporte sin archivos.
- Los datos del formulario se guardan temporalmente en MongoDB, colección `redline_bot.reportPending`, vinculados al servidor y al usuario que los creó. Caducan a los 30 minutos y se eliminan oportunistamente al crear/consultar borradores.
- Se evita que el mismo borrador se procese dos veces mediante un estado `pending/processing`.
- Los archivos se envían al hilo privado de revisión (Canal Destino 2). El Canal Destino 1 recibe el aviso y el embed, sin duplicar los adjuntos.
- Se admiten hasta 10 archivos por reporte y 25 MB en total: fotos JPG, PNG, GIF, WEBP y AVIF; vídeos MP4, WEBM, MOV y 3GP.
- La descarga valida HTTPS, host CDN de Discord, MIME declarado y MIME de la respuesta, tamaño y timeout.

### Archivos y commits

- `dashadmin/reporte/reportemodal.ts`: conserva el formulario y añade el paso opcional, persistencia temporal, carga y envío al hilo.
- `dashadmin/reporte/interactionreporte.ts`: enruta los dos botones y el modal de archivos.
- `dashadmin/reporte/reportFileUpload.ts` (nuevo): validación y descarga segura de fotos/vídeos.
- Commits:
  - `53cb89558f5472b4c2c69011563a038c924652ff`: lógica del paso opcional.
  - `cd522debaf01a024af32ce5b528463e2bd79b22b`: enrutamiento.
  - `a44eaca0e0b38ecad94bbad0cc7ecf89a08b1e22`: helper de archivos.

### Verificación pendiente

- Render tiene Auto Deploy activo en la rama `BOTGT7`; los tres commits han entrado en esa rama y deben desplegarse automáticamente.
- Pendiente confirmar que el build de Render termina en LIVE.
- Pendiente probar en Discord desde móvil: enviar sin adjuntos; adjuntar una foto; adjuntar un vídeo; y confirmar que ambos tipos aparecen dentro del hilo privado de revisión.
- No declarar la carga funcional como verificada hasta completar esas pruebas reales.


## 19. Segundo formulario obligatorio para las pruebas del reporte — 9/11/2026

### Ajuste solicitado

- El primer formulario queda con cuatro campos obligatorios: jornada, piloto que reporta, piloto a reportar y descripción. Se elimina el quinto campo de enlace.
- Después aparece un único botón: **Adjuntar pruebas**.
- El segundo formulario incluye dos campos opcionales: **Link** (enlace web) y **Archivo** (selector de hasta 10 fotos o vídeos).
- La validación exige al menos uno de los dos campos. Si ambos están vacíos, no se procesa el reporte y se ofrece volver a abrir el segundo formulario.
- Se puede enviar solo con enlace, solo con archivos o con ambos.
- Se elimina la opción anterior «Omitir y enviar».
- Se conserva el destino de revisión privada y el aviso/resumen en el canal de avisos.

### Archivos modificados

- `dashadmin/reporte/reportemodal.ts`: primer formulario de cuatro campos; botón único «Adjuntar pruebas»; segundo formulario con Link y Archivo; validación de al menos una prueba.
- `dashadmin/reporte/interactionreporte.ts`: retirado el enrutamiento del botón antiguo «Omitir y enviar».
- `dashadmin/reporte/reportFileUpload.ts`: admite cero archivos cuando se ha proporcionado un enlace y mantiene las validaciones de los archivos adjuntos.

### Verificación pendiente

- Revisión estática de los cambios.
- Build de Render y comprobación de arranque.
- Pruebas en Discord: solo link; solo archivo; link y archivo; y ambos vacíos (debe impedir el envío).
- No se considera verificada la carga real hasta completar esas pruebas.


## 19. Flujo de reportes: quinto campo informativo y formulario de pruebas

- Primer formulario: jornada, piloto que reporta, piloto denunciado, descripción y un quinto campo **Nota (opcional)** cuyo placeholder indica «Pulsa ENVIAR para adjuntar tus archivos o enlaces».
- Al enviar el primer formulario se conserva un único borrador de reporte y aparece un mensaje efímero informativo **ADJUNTAR PRUEBAS**, sin pregunta, con el botón **Continuar**.
- Continuar abre el segundo formulario con Link y Archivo opcionales. Para finalizar se exige al menos uno; si ambos están vacíos, el borrador se conserva y se puede reabrir el formulario.
- Link, archivos y datos del primer formulario se integran en el mismo reporte/hilo privado. Si el campo Nota contiene texto, también se muestra en el embed.
- En `commands/reporte.ts`, los nuevos paneles de reportes y pasos de configuración usarán el pie «REDLINE BOT GT» en lugar de «DISCORDBOT».
- **Pendiente:** el panel ya publicado no se puede editar desde el código fuente solamente: hace falta localizar el mensaje existente (canal y mensaje) para editar su embed conservando el botón. El cambio de footer del código solo afecta a los paneles que se publiquen después.
- Revisión estática de cambios: pendiente de completar; pruebas en Discord y despliegue: pendientes.


## 20. Flujo de defensas con pruebas adjuntas — 9/11/2026

- Se conservan los cuatro primeros campos originales del formulario de defensa: ID del reporte, piloto que reportó, piloto en defensa y explicación/alegación.
- Se añade un quinto campo **Nota (opcional)** con la indicación «Pulsa ENVIAR para adjuntar tus archivos o enlaces».
- Tras el primer envío se guarda un borrador en MongoDB `redline_bot.defensaPending` y aparece el mensaje informativo **ADJUNTAR PRUEBAS**, con botón **Continuar**.
- El segundo formulario permite **Link** y **Archivo** (hasta 10 fotos/vídeos), opcionales individualmente; se exige al menos uno para completar la defensa.
- La defensa completa y sus pruebas se publican en el hilo del reporte correspondiente; si no se encuentra, se usa el Canal Destino 2. El Canal Destino 1 recibe el aviso/resumen, sin duplicar archivos.
- Se reutiliza el validador seguro de archivos del módulo de reportes y la conexión MongoDB existente del módulo de defensas.
- Pendiente: build/deploy Render y pruebas reales en Discord (solo link, solo archivo, ambos y ninguno).


## 21. Actualización del pie de dos paneles de reportes — 9/11/2026

- Se amplió la actualización automática al iniciar el bot para revisar los dos mensajes existentes del canal `1463095951492386888`:
  - `1555166534576382016`
  - `1555166688008208417`
- Si el pie del embed es `Discord bot` o `DISCORDBOT`, se sustituye por **REDLINE BOT GT**.
- Se conserva el contenido de cada embed, su icono de pie y los botones/componentes originales.
- El proceso registra por separado si cada mensaje no necesita cambios o si no se pudo actualizar.
- Commit: `6cbc1a3983c3aa8070ce00268382242a7a59a4d8` (`Index.ts`, rama `BOTGT7`).
- Pendiente: confirmar despliegue LIVE y comprobar en Discord que ambos mensajes muestran el nuevo pie. La actualización se ejecuta al conectar el bot; guardar el cambio en GitHub no modifica los mensajes publicados hasta que el nuevo código arranque.

## 22. Retirada de la actualización temporal del pie de reportes y revisión visual del embed de eventos — 9/11/2026

- `Index.ts`: retirado el bloque temporal que editaba al arrancar los mensajes de reportes `1555166534576382016` y `1555166688008208417` del canal `1463095951492386888`.
- También se retiraron los imports `EmbedBuilder` y `TextChannel` que solo se utilizaban en ese bloque.
- Los pies ya corregidos permanecen guardados en los mensajes de Discord; no necesitan que el bot los vuelva a editar en cada arranque.
- Commit: `a670cf7a8e30c69b55530f0c872627b9bd50fbbc`.
- Despliegue Render: pendiente de confirmar LIVE.

### Embed de eventos: diagnóstico visual

- `dashadmin/eventos/eventosmanager.ts` construye el embed de eventos y actualmente llama a `.setTimestamp()`.
- Cada interacción RSVP vuelve a construir el embed mediante `buildEventEmbedAndRows()`, por lo que ese timestamp se renueva y es el indicador temporal que cambia con cada interacción.
- El color actual del embed es azul (`0x0055FF`) mientras el evento está activo y gris al finalizar/cancelarse.
- Discord permite el color lateral del embed y campos/pie, pero no una caja con fondo de color independiente dentro del embed.
- Propuesta visual pendiente de aprobación: sustituir el timestamp automático por un pie explícito **🕒 ACTUALIZADO · hoy a las HH:mm** (hora de Madrid), manteniendo el color lateral azul. No modificar todavía el embed hasta acordar la presentación.

### Actualización visual del embed de eventos — 9/11/2026

- En `dashadmin/eventos/eventosmanager.ts` se ha sustituido el timestamp automático del pie por un primer campo justo después de la imagen.
- Texto: **🕒 ACTUALIZADO · HOY A LAS HH:mm**, todo en negrita y mayúsculas, en una sola línea.
- La hora se genera con `Intl.DateTimeFormat` y zona horaria `Europe/Madrid`; se recalcula cada vez que se reconstruye el embed tras una interacción.
- Se mantiene el color azul del embed activo, el gris de eventos finalizados y todos los campos/listas existentes.
- Commits: `51a24ca597432bb5a52f647f4f0663e0cad8ee15` (función) y `cb06d2e9625a6f1dbd7896c7131c7971b76f1f2a` (ajuste de formato).
- Retirada del bloque temporal de footer en `Index.ts`: despliegue `dep-dbp3bh95efls73anok8g` confirmado LIVE antes de los cambios visuales del embed.
- Despliegue del nuevo embed: pendiente de confirmar LIVE y de comprobarlo en Discord.

## 23. Unificación visual de /dash y ampliación de IDs en avisos — 9/11/2026

### Panel /dash
- commands/dash.ts: se conservan los mismos customId y funciones de los 16 botones; solo se ajustan distribución, etiquetas y estilos.
- Etiquetas: «Crear Form», «Editar Form», «Colocar Formulario» y «Enviar Veredicto».
- «Colocar Formulario» pasa a rojo (Danger); «Editar Defensa» pasa a azul (Primary); «Crear Botón» pasa a verde (Success).
- «Enviar Veredicto» queda en rojo (Danger), como el botón anterior de Veredicto.
- «Colocar Formulario» y «Enviar Veredicto» comparten una fila de dos botones para que cada uno ocupe media fila.
- Se mantiene el panel sin embed ni texto descriptivo. /dashstaff no se modifica.
- Commit de la distribución inicial: d70e13a8eef48788e8e746a429df7703b5d8af8f.
- Commit de etiquetas/colores/distribución revisada: 581dbbca2eb776d93ed61aa73e0741448ba52b7f.

### IDs en notificaciones
- En los sistemas activos de dashadmin/avisos/avisosmanager.ts y dashadmin/welcome/welcomemanager.ts, los avisos incluyen IDs numéricos completos, además de las menciones/nombres:
  - Entradas y salidas: ID de usuario e ID del canal de destino.
  - Roles asignados y retirados: ID de usuario, ID de rol e ID del canal de destino.
- Los IDs aparecen tanto en el embed como en el contenido del mensaje para que sean visibles en la notificación push de Discord.
- El módulo activo de Avisos se inicializa desde Index.ts mediante setupAvisosSystem importado de dashadmin/avisos/avisosmanager.ts. El gestor de Bienvenidas/Despedidas también se inicializa desde Index.ts.
- La copia antigua handlers/avisosSystem.ts no es la ruta activa de inicialización identificada en Index.ts; no se ha modificado.
- Commits: 0f8f5d261ab144fc7b072bac133739b22dfd0a3a (Avisos) y c6402ee49c1f9a63d0034a1e9e2811adf998e982 (Bienvenidas/Despedidas y roles).

### Estado de verificación
- Revisión estática de los nombres, customId, colores y filas de /dash: realizada.
- Revisión estática de IDs en entradas, salidas, asignación y retirada de roles: realizada.
- /dashstaff no se ha tocado.
- Despliegue automático de Render para los commits de este bloque: en cola/en curso al registrar este estado; falta confirmar LIVE.
- Pendiente probar en Discord el panel y recibir notificaciones push reales para verificar cómo las presenta el móvil.

## 24. Reordenación final de /dash — 9/11/2026
- Commit: bbbae37d10b8cff705dc9c25605c642ae551754f.
- Se respeta el orden solicitado agrupando secciones consecutivas en 5 filas físicas, límite máximo de Discord:
  1. Edit Hola/Adiós + Configurar Avisos.
  2. Crear Sorteo + Crear Botón + Reaction Role + Encuesta.
  3. Enviar mensaje + Progr. Mensaje + Editar Reporte + Editar Defensa.
  4. Enviar Veredicto + Crear Form + Editar Form.
  5. Colocar Formulario + Crear evento + BD Eventos.
- Crear Form y Editar Form están en azul (Primary); Crear evento está en verde (Success).
- Se conservan todos los customId, handlers, permisos y comportamiento; /dashstaff no se toca.
- Revisión estática: cinco filas, 16 customId preservados y estilos solicitados comprobados.
- Deploy Render dep-dbp3u8e7bikc73d3mg0g estaba en build_in_progress al registrar el cambio; falta confirmar LIVE y probar en Discord.

## 25. Distribución acordada de /dash — 9/11/2026

- Se sustituye la distribución anterior de cinco filas por el orden especificado por el usuario:
  1. Edit Hola/Adiós + Configurar Avisos + Crear Sorteo + Crear Botón.
  2. Reaction Role + Encuesta + Crear evento + BD Eventos.
  3. Crear Form + Editar Form + Colocar Formulario.
  4. Editar Reporte + Editar Defensa + Enviar Veredicto.
  5. Enviar mensaje + Programar mensaje.
- Las filas 3 y 4 quedan con tres botones cada una para darles más espacio horizontal que a las filas de cuatro botones.
- Se conservan los 16 customId y sus estilos/funciones existentes. No se modifican handlers, permisos ni /dashstaff.
- Archivo: `commands/dash.ts`.
- Commit: `dbab7d1cc32f25d1ab4c8ee4eebd032a8187fcb1`.
- Revisión estática y prueba funcional en Discord: pendientes de completar; comprobar el despliegue automático de Render antes de probar /dash.


## 26. Nuevo comando independiente /clasificacion — 9/11/2026

- Se añade `commands/clasificacion.ts`, comando público `/clasificacion` que lee `Tabla2!B8:N` y muestra solo la clasificación general.
- Cada fila muestra posición, piloto, puntos totales y contadores: 🟣 VR (columna L), 🟡 PP (columna K) y 🔴 sanciones (columna M). Los puntos totales proceden de la columna N.
- No incluye resumen inferior, puntos de jornada, asistencia ni botones.
- No se modifica `dashsheet`, sus consultas, sus botones ni sus gestores.
- Se registra el comando en `Index.ts` y en `register-commands.ts`.
- Commits: `32a004a4ed4acbd69e199fe4b60e545f9e8e6178` (nuevo comando), `770ec1fe43b5c7217fef49e13571d5e997e6be21` (registro en cliente) y `0d67549afde5df612f399952737aec45255b9ef9` (registro global).
- Render: despliegues automáticos iniciados; el último estado consultado era `update_in_progress` para el código y `queued` para el commit de registro global. Pendiente confirmar LIVE.
- Pendiente prueba en Discord: ejecutar `/clasificacion` y comprobar que las columnas K/L/M/N corresponden a PP/VR/sanciones/puntos como se espera en la hoja.


## 27. Columnas alineadas en /clasificacion — 9/11/2026

- Se mantiene el encabezado actual **REDLINE GTCUP · 2ª Temporada** y el título del embed; no se añade logo ni imagen.
- La tabla pasa a un bloque de texto monoespaciado para alinear las columnas POS, PILOTO, PTS, VR, PP y SAN.
- Se retira la negrita de los nombres. Los nombres que superen 18 caracteres se acortan con puntos suspensivos para proteger el ancho en móvil.
- Se mantienen el origen de datos `Tabla2!B8:N`, el orden de clasificación, las medallas de los tres primeros y los contadores existentes. No se modifica `dashsheet`.
- Archivo: `commands/clasificacion.ts`.
- Commits de esta intervención: `3037c6c1`, `a483f972` y `52a4a475` (ajuste incremental del mismo archivo).
- Revisión estática: realizada. Prueba visual en Discord y comprobación de anchura en móvil: pendientes.
- Render: no se ha iniciado ni verificado manualmente ningún despliegue; comprobar el estado antes de considerar el cambio activo.


## 28. Avisos de roles sin embed — 10/11/2026

- En los dos manejadores activos de asignación de roles (dashadmin/avisos/avisosmanager.ts y dashadmin/welcome/welcomemanager.ts), el aviso se envía como mensaje normal, sin embed.
- El contenido del mensaje y de la notificación push móvil es idéntico: Usuario, Rol y Canal de origen; cuando corresponda, Canal indica Manual y el responsable.
- Se conservan los embeds de entradas y salidas de los sistemas de bienvenida/avisos y el aviso de retirada de rol; este cambio afecta al aviso de rol asignado solicitado.
- No se han cambiado los canales configurados, los permisos ni la detección del origen.
- Commits de código: b187ce3d2e128b3add6ae997689b8f8a109d7ebf y 644b8cbd022f78836bcc106aa99e75521d34b385 (rama BOTGT7).
- Pendiente: confirmar Render LIVE y probar una asignación real para comprobar el mensaje en Discord y la notificación móvil.


## 29. Formato compacto de /clasificacion — 10/11/2026

- Se elimina la fila de encabezados Piloto/Puntos/VR/PP/Sanciones.
- Cada piloto se muestra en una línea: posición o medalla, nombre en negrita y puntos en negrita.
- Los contadores de VR (🟣), PP (🟡) y sanciones (🔴) solo se añaden cuando su valor es mayor que cero; los valores cero no aparecen.
- Se conserva el título REDLINE GTCUP · 2ª Temporada, el embed general y el origen de datos Tabla2!B8:N.
- Archivo: commands/clasificacion.ts. Commit: 251a3ed2927722d622173b29329ec41d22b6716d.
- Pendiente confirmar Render LIVE y revisar el resultado real en Discord/móvil.


## 30. Clasificación en columnas sin embed ni medallas — 10/11/2026

- Se elimina el embed de `/clasificacion`; el comando responde con un mensaje normal para aprovechar el ancho disponible.
- Se mantiene el título **REDLINE GTCUP · 2ª Temporada** y la tabla monoespaciada con columnas independientes: posición numérica, piloto, puntos, VR, PP y sanciones.
- Se eliminan las medallas. La posición se muestra como número.
- Los contadores se muestran con sus círculos de color únicamente cuando son mayores que cero; las celdas sin valor quedan vacías.
- Se conserva la lectura de `Tabla2!B8:N` y el orden de los pilotos. Los nombres de más de 18 caracteres se recortan para proteger la alineación.
- Archivo: `commands/clasificacion.ts`. Commit de código: `93889768e74e52bff97162887a15c480b2abb8fe`.
- Pendiente: confirmar el despliegue de Render y comprobar visualmente la tabla en Discord, especialmente desde móvil.


## 31. Nombres de asistentes estables en eventos — 10/11/2026
- Ajuste posterior: se corrigió el separador de salto de línea de las listas para conservar una línea por asistente. Commit adicional: `4df1eadde26e074ccc9f87a3aff51e7928e13fdd`.


- En `dashadmin/eventos/eventosmanager.ts`, las listas de titulares, reservas, duda y no puedo muestran siempre el nombre visible, nunca el formato de mención `<@ID>`.
- Se resuelve primero desde la caché de miembros; si no está disponible, se consulta el miembro del servidor y, como último recurso, el usuario global.
- Si Discord no permite resolver el nombre, se muestra `Usuario no disponible`, nunca una mención rota ni un ID.
- No se modifican los IDs almacenados en RSVP, el orden, los estados, los límites ni las notificaciones privadas.
- Commit: `3da64365ba94e4fbb2a43272a727252d0a9619af` (rama `BOTGT7`).
- Pendiente: confirmar Render LIVE y comprobar un evento real en Discord/móvil.


## 32. Restauración de menciones en asistentes de eventos — 10/11/2026

- A petición del usuario, se restaura el formato nativo de mención de Discord en las listas de Titulares, Reservas, Duda y No puedo.
- Cada ID RSVP se representa como `<@ID>`; Discord mostrará el nombre normal asociado a la cuenta, sin depender de la caché ni de llamadas para resolver nombres.
- Se elimina el fallback textual `Usuario no disponible`. Los IDs RSVP, el orden, los estados, límites y demás lógica del evento permanecen intactos.
- Las menciones dentro de los campos del embed no generan avisos individuales; se mantiene sin cambios el sistema de notificación del evento.
- Archivo: `dashadmin/eventos/eventosmanager.ts`. Commit: `61b0adda200f9a3aaf5171ae01ea075487147b70` (rama `BOTGT7`).
- Pendiente: confirmar Render LIVE y comprobar visualmente los nombres en un evento real desde Discord móvil/escritorio.


- Ajuste adicional: se asegura que los asistentes queden separados por saltos de línea reales en el embed. Commit: `344edb9288a80ed86d996d7ab4ea5e0d8cb0511c`.


## 33. Username normal sin menciones en listas de eventos — 10/11/2026

- Se cambia de nuevo la presentación de Titulares, Reservas, Duda y No puedo: ahora se muestra el campo `user.username` de Discord como texto plano, sin `<@ID>`, sin @ y sin usar el apodo del servidor ni el nombre global.
- Resolución: caché de miembros; consulta del miembro del servidor; y consulta global del usuario como último recurso. Las consultas pendientes se limitan a cuatro en paralelo.
- Si Discord no permite recuperar la cuenta, se muestra `Usuario no disponible`; no se inventa ningún nombre.
- Se conservan los IDs RSVP, el orden, estados, límites, roles, avisos y resto de lógica del evento.
- Archivo: `dashadmin/eventos/eventosmanager.ts`. Commit: `2c3d6152c1f8b235f123f0790697752f0fc25426` (rama `BOTGT7`).
- Pendiente: confirmar Render LIVE y comprobar en Discord móvil/escritorio que los nombres se leen como username normal.


## 34. Nombres de asistentes con la misma prioridad que WEBLINEGT — 10/11/2026

- Se corrige la presentación de las listas de Titulares, Reservas, Duda y No puedo para replicar el comportamiento de WEBLINEGT.
- Prioridad de resolución: apodo del miembro en el servidor (`nickname`) > nombre global de Discord (`globalName`) > username (`username`) > ID como último recurso.
- Los nombres se muestran como texto plano: sin mención, sin `@` y sin formato de ping.
- La resolución consulta primero la caché de miembros, después intenta recuperar el miembro del servidor y, si no está disponible, consulta el usuario global.
- Se añade caché de nombres (1 hora), caché de fallos (1 minuto), deduplicación de consultas pendientes y un máximo de cuatro consultas simultáneas.
- Se mantienen intactos los IDs almacenados en RSVP, el orden de las listas, estados, límites, roles, promociones, avisos y demás lógica de eventos.
- Archivo: `dashadmin/eventos/eventosmanager.ts`.
- Commit de código: `4bf9c9213feec1c5a7021632f2ee527633b38962` (rama `BOTGT7`).
- Revisión estática: realizada. Compilación, despliegue Render y prueba real en Discord/móvil: pendientes de confirmar.


## 35. Corrección de saltos de línea en listas de asistentes — 10/11/2026

- Incidencia: los nombres de Titulares, Reservas, Duda y No puedo se concatenaban porque el separador estaba escrito como texto literal `\\n`.
- Corrección acotada en `dashadmin/eventos/eventosmanager.ts`: el separador ahora es `\\n` como escape de salto de línea real en TypeScript.
- No se modifica la prioridad de nombres, la caché, los RSVP, límites, roles ni notificaciones.
- Commit de código: `f4cc8a47973687da9860f20fe1d1dc61eaf5a4b2` (rama `BOTGT7`).
- Revisión del cambio: solo se sustituyó el separador de las listas.
- Pendiente: confirmar despliegue Render y comprobar la presentación en Discord. Los mensajes de evento ya publicados no se reescriben por el mero hecho de desplegar; deben reconstruirse mediante una interacción o una actualización específica.


## 36. Campo invisible del aviso de actualización — 10/11/2026

- En `dashadmin/eventos/eventosmanager.ts`, se corrige el nombre del campo que precede a «🕒 ACTUALIZADO · HOY A LAS...».
- El literal tenía doble escape y Discord mostraba `\\u200B` como texto. Ahora usa el escape Unicode correcto de un carácter de ancho cero, por lo que el encabezado queda visualmente vacío.
- No se cambia el texto de actualización ni el contenido de las listas.
- Commit de código: `12bb4a287e31a76a90fc45e04097d66ef6ff9f5f` (rama `BOTGT7`).
- Pendiente confirmar Render LIVE y comprobar el mensaje reconstruido en Discord.
