# Estado del proyecto — REDLINEBOTGT

**Última actualización:** 8 de noviembre de 2026  
**Repositorio:** [RedlineBotGt/REDLINEBOTGT](https://github.com/RedlineBotGt/REDLINEBOTGT)  
**Rama de trabajo:** `main`  
**Servicio Render principal:** `REDLINEBOTGT` — Frankfurt  
**URL:** https://redlinebotgt.onrender.com

> Este documento es el punto de continuidad del proyecto. Actualizarlo cuando se hagan cambios relevantes, pruebas, despliegues o se descubran incidencias. No confundir este bot con WEBLINEGT, Academia Campos ni el servicio suspendido REDLINEBOTGT7.

## 1. Estado operativo conocido

- El bot principal se ejecuta en Render, Frankfurt, desde la rama `main`.
- El despliegue es **manual**: `autoDeploy=no`. Los commits en GitHub no activan por sí solos una nueva versión en Render.
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

## 6. Riesgos y tareas pendientes

- En una revisión anterior se detectaron credenciales sensibles incluidas en el repositorio público (incluyendo un archivo de credenciales y copias de claves/URI en código). **No consta que se hayan rotado o revocado.** Prioridad de seguridad: rotar credenciales expuestas y después retirar los secretos del historial/repositorio de forma controlada. Nunca copiar secretos a este documento.
- Revisar la salud real del bot: actualmente `/health` puede responder aunque el cliente Discord no haya conectado.
- Revisar el manejo de `uncaughtException`: el proceso registra el error, pero no fuerza una salida controlada.
- Verificar en ejecución la ruta de estado de Academia Campos antes de dar por garantizado que el ping la mantiene activa.
- No implementar un ping a WEBLINEGT sin decisión expresa.

## 7. Normas de trabajo

- Revisar el estado actual de GitHub antes de editar.
- Mantener cambios acotados y explicar exactamente qué archivos se modifican.
- No tocar funciones ajenas al objetivo solicitado.
- No desplegar automáticamente ni asumir que un commit está activo en Render.
- Proteger eventos programados o en curso.
- Después de cada cambio, actualizar este documento con commit, archivos, pruebas, despliegue y pendientes.
- Si una prueba falla, revertir solo el cambio concreto cuando sea posible y dejar constancia.

## 8. Último punto de trabajo

**Tarea actual:** recuperar la apariencia de mención para participantes de las tarjetas de evento, manteniendo la resolución de nombres como fallback.

**Estado de esta actualización:** código y documento actualizados en GitHub; pruebas estáticas aisladas superadas; prueba visual real pendiente; Render sin desplegar.
