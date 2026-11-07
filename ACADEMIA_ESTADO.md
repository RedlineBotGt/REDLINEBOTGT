# Academia Campos — Estado vivo del proyecto

**Última consolidación:** 7 de noviembre de 2026  
**Repositorio:** `RedlineBotGt/REDLINEBOTGT`  
**Rama de trabajo de Academia:** `backup-antes-limpieza` (también denominada por el usuario `backupantesdelimpieza`)  
**Rama `main`:** pertenece a REDLINE BOT GT y debe permanecer separada e intacta.  
**Estado:** trabajo en curso; no desplegar sin autorización expresa.

Este documento es la referencia de continuidad del proyecto. Debe actualizarse al terminar cada bloque relevante de trabajo, registrando qué se cambió, qué se comprobó, qué queda pendiente y cuál es el siguiente paso. No sustituye al código ni autoriza cambios fuera del alcance acordado.

---

## 1. Normas de trabajo vigentes

1. Trabajar exclusivamente en la rama `backup-antes-limpieza` para Academia Campos. No mezclar con `main` ni con el funcionamiento de REDLINE BOT GT.
2. Antes de modificar, recuperar este estado y revisar el archivo real de GitHub. No repetir análisis ya cerrados sin motivo.
3. Hacer cambios pequeños, aislados y justificados. No refactorizar ni «mejorar» partes ajenas a la tarea.
4. Conservar las funciones que ya funcionan. Si una modificación puede afectar a otra función, detenerse y comprobar antes.
5. El usuario trabaja principalmente desde Android: cuando tenga que pegar código, entregar archivos completos, con ruta exacta y listos para copiar. Si superan aproximadamente 400 líneas, dividirlos en partes ordenadas.
6. Avanzar paso a paso. No dar por hecho que un archivo está cambiado porque se haya propuesto el código; distinguir entre propuesto, guardado en GitHub, probado y desplegado.
7. No hacer deploy, ni activar despliegues, ni modificar Render sin autorización expresa del usuario.
8. No pedir al usuario que repita datos que ya constan aquí o en el historial recuperable.
9. No cambiar diseño, navegación, perfiles, progreso, persistencia, Deberes o ranking cuando la tarea sea el motor de ejercicios, salvo petición expresa.
10. Mantener este documento actualizado con arquitectura, inventario, decisiones, cambios, errores, pruebas y siguiente paso.

## 2. Objetivo funcional y decisiones

Academia Campos es una aplicación web familiar e independiente de REDLINE BOT GT.

- Perfiles: `leo`, `papa`, `mama`.
- Los tres perfiles comienzan desde el mismo nivel inicial.
- El historial y progreso deben ser independientes por perfil y, cuando se implante el sistema completo, por asignatura.
- Asignaturas: Cultura general, Retos Imposibles, Matemáticas y Geografía (las cuatro habilitadas en la selección de ejercicios).
- Cultura general usa la clave canónica `cultura_general`; `lateral` se conserva como alias histórico exclusivamente de Cultura general.
- Retos Imposibles usa la clave independiente `pensamiento_lateral`.
- Cultura general es la base funcional que debe preservarse.
- Matemáticas ya está habilitada en los validadores del frontend y backend; su generador/evaluador está separado en su propio módulo. Pendiente probar generación y evaluación reales tras el despliegue.
- Geografía queda habilitada con generación y evaluación propias, usando el mismo flujo de pista, respuesta y siguiente ejercicio que Cultura general.
- Deberes es una función independiente y debe permanecer intacta.
- El ranking anterior no se debe conservar como diseño definitivo. Se rediseñará desde cero cuando corresponda: clasificación general y vistas independientes por asignatura. No implementar ahora.
- Los niveles deben ser independientes por asignatura.
- No reconstruir ni cambiar la interfaz que ya funciona por una tarea de backend/IA.

## 3. Infraestructura y despliegue

### Separación de proyectos

- `main` es REDLINE BOT GT.
- `backup-antes-limpieza` es la base separada de Academia Campos.
- Academia debe tener su propio `server.ts`, `package.json`, servicios, rutas y web pública.
- No depender de `Index.ts`, `register-commands` ni de la inicialización de Discord para servir Academia.

### Configuración observada en el repositorio

El `package.json` de la rama indica:
- Node `>=22`.
- Build: `tsc -p tsconfig.json` y copia de `public` a `dist/public`.
- Start: `node dist/server.js`.
- Dev: `tsx watch server.ts`.
- Dependencias principales: `@google/genai`, Express, CORS, dotenv, MongoDB y tsx.
- TypeScript 5.7.x y tipos Node 22.

El `server.ts` consultado:
- Inicia Express en `0.0.0.0`, puerto `process.env.PORT || 3000`.
- Carga variables con dotenv.
- Sirve la carpeta pública detectándola mediante varias rutas posibles.
- Registra diagnóstico de arranque y disponibilidad de Gemini, MongoDB y acceso privado de Papá.
- Expone `/api/academia/status`, `/api/academia/diagnostico` y `/api/academia`.
- Monta `routes/questions.ts` y `routes/homework.ts`.

### Render (configuración histórica acordada; verificar antes de cambiar)

Se había acordado un servicio independiente `academia-campos`, conectado a `backup-antes-limpieza`, región Frankfurt y plan gratuito. Build `npm install && npm run build`; Start `npm start`. El usuario indicó que su despliegue en Render es manual. No asumir que la configuración actual sigue idéntica sin comprobarla.

Variables utilizadas por el servidor:
- `GEMINI_API_KEY` (también se reconocen alias en el motor).
- `MONGODB_URI`.
- `PAPA_PIN`.
- `PAPA_SESSION_SECRET`.

Nunca guardar valores secretos en este documento.

## 4. Arquitectura e inventario confirmado

### Raíz

- `package.json`: scripts, runtime y dependencias.
- `tsconfig.json`: compilación NodeNext, modo estricto, salida `dist`, incluye `server.ts`, `routes/**/*.ts` y `services/**/*.ts`.
- `server.ts`: servidor independiente y montaje de rutas.
- `public/`: interfaz web y módulos JavaScript.
- `routes/`: endpoints de ejercicios y Deberes.
- `services/`: fachada de IA, motor Gemini y módulos por asignatura.

### Rutas

- `routes/questions.ts`: endpoints POST `/question` y `/answer`. Valida perfil/asignatura, genera el reto, mantiene temporalmente retos pendientes en memoria y evalúa respuestas. La solución no se envía al navegador.
- `routes/homework.ts`: autenticación de Papá y gestión de Deberes (consulta, creación, edición, borrado, resolución, completar/reabrir). No tocar durante la habilitación de asignaturas.

### Servicios de IA

- `services/aiService.ts`: fachada de compatibilidad. Tipos de asignatura `lateral | matematicas | geografia`; delega generación y evaluación a los módulos.
- `services/ai/gemini.ts`: comunicación común con Gemini, extracción y parseo JSON, timeout, reintentos y modelo de respaldo. Reconoce `GEMINI_API_KEY`, `GOOGLE_API_KEY` y `GEMAI_API_KEY`.
- `services/ai/schemas.ts`: esquemas compartidos de reto y evaluación.
- `services/subjects/index.ts`: exportaciones por asignatura y tipos.
- `services/subjects/culturaGeneral.ts`: prompt y evaluación de Cultura general, centrados en conocimientos de España, Europa y el mundo para 2.º-3.º de Primaria.
- `services/subjects/pensamientoLateral.ts`: módulo independiente de Retos Imposibles, con generación y evaluación de enigmas, lógica y pensamiento lateral.
- `services/subjects/matematicas.ts`: generación matemática y evaluación numérica.
- `services/subjects/geografia.ts`: generación y evaluación de preguntas geográficas con validación de respuesta y explicación.

### Web

- `public/index.html`: interfaz principal con selección de perfiles, asignaturas, pantalla de retos y Deberes.
- `public/js/subjects.js`: claves y nombres visibles de asignaturas; conserva `lateral` como Cultura general.
- `public/js/menu.js`: navegación y eventos para abrir perfil/asignatura.
- `public/js/challenges.js`: carga de reto, envío de respuesta, pista, siguiente pregunta y cancelación de peticiones.
- `public/app.js`: punto de entrada de módulos (confirmado en conversaciones previas).
- `public/js/homework/`: módulos de Deberes (hay al menos `forms.js`; el servidor comprueba expresamente su presencia).
- Hay más módulos de interfaz y estilos; completar el inventario exacto antes de una refactorización de frontend.

### Persistencia

- La persistencia de Academia debe mantenerse separada de REDLINE y sus eventos/campeonatos.
- En el código histórico de Academia, `academia/models.ts` obtiene una colección `user_progress` desde la conexión MongoDB de eventos, en la misma base de datos pero en una colección independiente.
- En la versión separada actual, comprobar el módulo real de MongoDB y las rutas de progreso antes de cualquier cambio. No deducir que el progreso ya está implementado por completo solo porque exista la colección.

## 5. Estado de Cultura general y Matemáticas

### Cultura general

- Clave canónica nueva: `cultura_general`.
- Alias históricos aceptados: `lateral`, `cultura` y `cultura general`; todos se normalizan a `cultura_general`.
- Contenido: conocimientos de España, Europa y el mundo, cultura, historia, monumentos, ciencia, naturaleza, arte y curiosidades.
- Nivel objetivo inicial: 2.º-3.º de Primaria.
- Ya no debe generar acertijos de pensamiento lateral.
- Un ejercicio por petición, con enunciado, pista, solución y categoría; evaluación por significado.

### Retos Imposibles

- Clave independiente: `pensamiento_lateral`.
- Módulo propio: `services/subjects/pensamientoLateral.ts`.
- Contenido: enigmas originales, lógica y pensamiento lateral, con pistas suficientes y soluciones razonadas.
- Nivel objetivo inicial: 2.º-3.º de Primaria.
- La evaluación acepta soluciones alternativas coherentes con las pistas.
- No introducir cambios en su prompt/evaluación al habilitar Matemáticas.

### Matemáticas

- Módulo independiente `services/subjects/matematicas.ts`.
- La operación debe aparecer explícitamente en el reto, con formato identificable como `OPERACIÓN: 27 + 15`.
- El servidor debe extraer y calcular la operación sin usar `eval`.
- La solución numérica debe calcularse en servidor y la evaluación debe comparar el resultado numérico.
- Riesgo pendiente detectado: si Gemini genera una historia/enunciado que no coincide con la operación explícita, el cálculo será correcto pero el problema narrativo será incoherente. La solución robusta será que el servidor construya el enunciado a partir de los operandos y la operación, o valide rigurosamente su correspondencia. No dar por resuelto este riesgo todavía.

## 6. Bloqueos detectados y correcciones aplicadas (7-11-2026)

La pantalla de Matemáticas mostró:
- «No se ha podido generar el ejercicio».
- «Esta asignatura todavía no está disponible. Estamos preparando Cultura general.»

Se han localizado dos bloqueos independientes que impiden que la petición llegue al motor matemático:

### Bloqueo A — frontend

Archivo: `public/js/challenges.js`.

La función `obtenerAsignaturaValida()` solo acepta `lateral` y `cultura`; cualquier otra asignatura lanza el error de asignatura no disponible. Por tanto, Matemáticas falla antes de llamar a la API.

Corrección aplicada directamente en GitHub:
- `lateral` o `cultura` -> enviar `cultura`.
- `matematicas` -> enviar `matematicas`.
- `geografia` -> enviar `geografia` al backend.
- Cualquier otra clave -> error de selección no válida.
- El log de recepción muestra la asignatura seleccionada.

Commit: `0e2beb0630e15cc38b303654f0ac78366cf8e3de`.
Blob SHA verificado: `e2abf69b07f3de388e5fc100ec67ee29972f4894`.

### Bloqueo B — backend

Archivo: `routes/questions.ts`.

La función `obtenerAsignatura()` solo reconoce Cultura general y devuelve `null` para Matemáticas. El endpoint `POST /question` responde que solo está disponible Cultura general. El endpoint `POST /answer` usa el mismo validador y también rechaza Matemáticas.

Corrección aplicada directamente en GitHub:
- Reconoce `matematicas` y `matemáticas` como `matematicas`.
- Reconoce `geografia` como asignatura activa.
- El mensaje de error enumera Cultura general y Matemáticas.
- El log de generación muestra la asignatura real.
- Se mantienen intactos el control de perfil, nivel inicial 1, mapa de retos pendientes, expiración, límites, protección de la solución y evaluación.

Commit: `f8c07bec6c7577e9a38d835ae70cf18a11a04b0b`.
Blob SHA verificado: `9bf84e02ac61f61abb2519e38073c5403578957f`.

### Estado de guardado de estos cambios

Ambos cambios están guardados y se han vuelto a leer desde GitHub en la rama de Academia. La barrera de validación frontend/backend está corregida. Esto no equivale todavía a confirmar que Gemini genere ejercicios correctos: falta deploy manual y prueba funcional de extremo a extremo.

## 7. Riesgos técnicos a comprobar después de desbloquear

1. Probar generación y evaluación matemática de extremo a extremo, no solo que la pantalla deje de bloquear la petición.
2. Revisar el comportamiento de `consultarConRespaldo`: el fallback se activa ante errores temporales; un JSON inválido o un contenido incompleto puede no probar el segundo modelo. Evaluar una validación y fallback apropiados sin cambiar el comportamiento de Cultura general.
3. Comprobar la coherencia entre enunciado, operación y resultado matemático.
4. Comprobar que los errores de Gemini se muestran sin dejar la pantalla bloqueada y que los controles recuperan su estado.
5. Verificar que Cultura general sigue generando y evaluando igual que antes.
6. Probar generación y evaluación de Geografía.
7. Confirmar que Deberes y la navegación no han sufrido regresiones.
8. Ejecutar compilación TypeScript y pruebas disponibles antes de autorizar cualquier despliegue.

## 8. Decisiones que no deben reabrirse sin motivo

- Academia vive en `backup-antes-limpieza`, separada de `main`.
- Mantener el proyecto actual; no crear otro repositorio ni otro proyecto ChatGPT.
- No reconstruir toda la web para modularizar la IA.
- Separar motor Gemini común y módulos específicos por asignatura.
- Cultura general y Retos Imposibles son asignaturas distintas; `lateral` se mantiene como alias histórico de Cultura general, nunca como clave de Detectives.
- Matemáticas se habilita como siguiente asignatura.
- Geografía queda para una fase posterior.
- No alterar Deberes.
- No implementar ahora el ranking antiguo ni sustituirlo por otro hasta diseñarlo expresamente.
- No cambiar perfiles, niveles, historial, puntuación o persistencia durante esta fase.

## 9. Registro de cambios y pruebas

| Fecha | Elemento | Acción / resultado | Estado |
|---|---|---|---|
| 2026-11-06 | `services/subjects/culturaGeneral.ts` | Reconstruido para conservar prompt y evaluación originales de Cultura general. | Entregado en conversación; revisar SHA antes de asumir guardado |
| 2026-11-06 | `services/ai/schemas.ts` | Esquemas comunes recuperados en minúsculas y sin `propertyOrdering`. | Entregado en conversación; revisar SHA antes de asumir guardado |
| 2026-11-06 | `services/subjects/matematicas.ts` | Generador/evaluador con operación explícita y cálculo seguro en servidor. | Entregado en conversación; riesgo de coherencia narrativa pendiente |
| 2026-11-06 | `services/subjects/index.ts` | Exportaciones separadas por asignatura. | Entregado en conversación; revisar SHA antes de asumir guardado |
| 2026-11-06 | `services/aiService.ts` | Revisado como fachada de compatibilidad; no requiere cambio conocido. | Revisado |
| 2026-11-06 | `services/ai/gemini.ts` | Revisado estructuralmente; no modificar sin evidencia. | Revisado |
| 2026-11-07 | `public/js/challenges.js` | Desbloqueada Matemáticas en frontend; Geografía sigue bloqueada; log dinámico. | Guardado en GitHub y releído |
| 2026-11-07 | `routes/questions.ts` | Desbloqueadas generación y evaluación para Matemáticas; alias acentuado; mensaje/log dinámicos. | Guardado en GitHub y releído |
| 2026-11-07 | `services/subjects/matematicas.ts` | Añadido historial en memoria de los últimos 25 enunciados por nivel, instrucciones para no repetir, código de variación por petición y hasta 4 intentos si Gemini devuelve un enunciado idéntico. | Guardado en GitHub y releído; pendiente compilación y prueba en Render |

| 2026-11-07 | Build TypeScript | No ejecutado desde este entorno; pendiente antes o después del deploy manual. | Pendiente |
| 2026-11-07 | Prueba funcional en Render | Usuario realizará deploy manual y probará Matemáticas. | Pendiente |

No marcar una prueba como superada si solo se ha inspeccionado el código. Registrar separadamente: revisado, modificado, compilado, probado localmente, probado en Render.

## 10. Siguiente secuencia de trabajo

1. El usuario hará el deploy manual de la rama de Academia para probar Matemáticas.
2. Comprobar en Render que se genera un ejercicio, que la operación y el enunciado son coherentes y que la evaluación acepta la respuesta numérica correcta.
3. Si falla, recoger el mensaje de pantalla y los logs; no cambiar otros módulos por intuición.
4. Revisar y corregir la coherencia entre historia y operación: el módulo actual pide a Gemini que coincidan, pero no verifica esa correspondencia de forma independiente.
5. Ejecutar/confirmar build TypeScript y pruebas de regresión de Cultura general.
6. Confirmar que Geografía sigue bloqueada y que Deberes permanece intacto.
7. Actualizar este documento con resultados reales y siguiente paso.

---

## 11. Separación de Cultura general y Retos Imposibles (7-11-2026)

Nombre visible vigente para pensamiento lateral: **Retos Imposibles** (sustituye al nombre provisional Detectives de la Mente).

Cambios guardados en la rama `backup-antes-limpieza`:
- Creado `services/subjects/pensamientoLateral.ts` con generación y evaluación propias de enigmas y razonamiento. Commit `5c7638cda39670be80c5b97c46d8b5feab590852`.
- Actualizado `services/subjects/index.ts` para exportar el módulo nuevo. Commit `ce37c8d27ce79ff8c18b419e8b2b5da8ff39ada3`.
- Actualizado `services/aiService.ts` para enrutar las cuatro asignaturas sin mezclar Cultura general y pensamiento lateral; conserva `lateral` como alias de Cultura general. Commit `48f6877277512bb96877e7bdd5dbede4e3503b98`.
- Actualizado `services/subjects/culturaGeneral.ts`: ahora genera conocimientos de España, Europa y el mundo, nivel objetivo 2.º-3.º de Primaria. Commit `e814d4834fa97341a8cc79789269b30593d49674`.
- Actualizado `routes/questions.ts`: normaliza claves nuevas y alias antiguos; mantiene Matemáticas y Geografía desactivada. Commit `f7ab79dbb28ff0f982e83ba572c76801eb63b987`.
- Actualizado `public/js/subjects.js` y `public/js/challenges.js`: claves independientes en frontend y alias antiguo para Cultura general. Commits `8b63e1f8a8655508fafbd62657ed67476957ba4c` y `44ed585fe69d2a5358486eb3032fc5f415a33f6b`.
- Actualizado `public/index.html`: muestra botones separados para Cultura general y Retos Imposibles. Commit `9ce8594b06b6ea152116eefbb0bf4249ed986226`.
- No se ha tocado `public/js/ranking.js`, Matemáticas, Deberes, perfiles, progreso ni persistencia.

Compatibilidad y cautelas:
- La clave antigua `lateral` se asigna solo a Cultura general. No se reutiliza para Retos Imposibles.
- El ranking anterior permanece sin cambios y pendiente de rediseño futuro.
- El usuario confirma que el paso 1 (pruebas de Matemáticas) está hecho; no se han añadido aquí detalles ni resultados técnicos que no consten.
- Los cambios anteriores están guardados en GitHub, pero todavía no se han compilado ni probado en Render. No desplegar sin autorización expresa.

Siguiente paso:
1. Releer los archivos modificados y comprobar rutas, nombres, alias y sintaxis.
2. Ejecutar build TypeScript.
3. Probar Cultura general y Retos Imposibles por separado con los tres perfiles, comprobando generación, pista, respuesta correcta/incorrecta y siguiente ejercicio.
4. Confirmar que Matemáticas sigue funcionando y Geografía sigue bloqueada.
5. Solo después, abordar Geografía.

---

## 12. Protocolo de continuidad para futuras sesiones

Al retomar Academia Campos:
1. Leer este archivo primero.
2. Consultar la rama `backup-antes-limpieza` y el estado real de los archivos relacionados con la tarea.
3. Comparar con el registro de cambios y corregir cualquier dato obsoleto.
4. Continuar desde el siguiente paso pendiente; no reiniciar la revisión general.
5. Actualizar este archivo al cerrar cada bloque de trabajo.

**Regla de oro:** mantener lo que funciona, tocar solo lo necesario y no desplegar sin permiso.


---

## 13. Habilitación de Geografía (7-11-2026)

El usuario confirma que Cultura general funciona y solicita abrir Geografía con el mismo estilo.

Cambios guardados en `backup-antes-limpieza`:
- `services/subjects/geografia.ts`: se conserva el generador de la asignatura, se valida que el ejercicio incluya enunciado, pista, solución y categoría, y se añade evaluación semántica con Gemini y el esquema común.
- `services/subjects/index.ts`: exporta generación y evaluación de Geografía.
- `services/aiService.ts`: enruta la evaluación de Geografía al nuevo evaluador.
- `routes/questions.ts`: acepta Geografía en generación y evaluación, manteniendo el control de perfil, reto pendiente y solución protegida.
- `public/js/challenges.js`: deja de bloquear Geografía y envía la clave `geografia`. El botón ya existía en `public/index.html`; no fue necesario modificar la interfaz.
- El flujo común conserva pista, reintentos cuando la respuesta no es correcta y botón de siguiente pregunta al acertar.

**Alcance:** no se han modificado perfiles, niveles, progreso, persistencia, Deberes ni ranking. No se ha compilado ni desplegado todavía. La habilitación está guardada en GitHub, pendiente de compilación y prueba funcional.

**Siguiente paso:** ejecutar build TypeScript, corregir solo errores relacionados con este cambio y esperar autorización del usuario para el deploy manual. Después probar Geografía (generación, pista, respuesta incorrecta y correcta, siguiente pregunta) y comprobar regresión de Cultura general y Matemáticas.


---

## 14. Historial de preguntas por perfil y asignatura (7-11-2026)

El usuario autoriza implantar un historial común de preguntas para todas las asignaturas, independiente por perfil y materia.

### Diseño aplicado en código
- Memoria en servidor, identificada por `perfil:asignatura`.
- Perfiles: `leo`, `papa`, `mama`.
- Asignaturas: `cultura_general`, `matematicas`, `geografia`, `pensamiento_lateral` (Retos Imposibles).
- Máximo: 30 enunciados recientes por cada combinación perfil/asignatura.
- Todos los generadores reciben su historial reciente y se les instruye para evitar repetir tanto el enunciado como el mismo concepto/idea.
- La ruta comprueba duplicados exactos normalizados y permite hasta cuatro intentos de generación antes de devolver un error controlado.
- Matemáticas deja de mantener una memoria global por nivel (25 ejercicios); utiliza el historial independiente que recibe desde la ruta.
- El historial se añade al generar correctamente el ejercicio, no depende de que el alumno acierte.
- No se modifican niveles, puntos, progreso, MongoDB, ranking, Deberes ni interfaz.

### Limitación conocida
La memoria es temporal y reside en RAM. Se pierde al reiniciar o volver a desplegar el servidor. No se ha añadido persistencia en MongoDB para respetar el alcance autorizado. La detección determinista bloquea enunciados idénticos tras normalización; evitar preguntas semánticamente parecidas depende también de las instrucciones al modelo y no constituye una garantía matemática.

### Estado de verificación
- Cambios guardados en GitHub y releídos desde la rama de trabajo.
- Comprobadas las firmas y el paso del historial por la fachada a los cuatro generadores.
- Comprobados el límite de 30, la clave perfil/asignatura, la normalización y el reintento ante duplicados, incluida la comprobación tras peticiones simultáneas.
- Compilación TypeScript: pendiente; no se pudo ejecutar desde este entorno porque no fue posible clonar el repositorio.
- Despliegue Render: no realizado.
- Prueba funcional en Render: pendiente.


---

## 15. Instalación PWA y acceso directo Android (7-11-2026)

El usuario solicita que Academia Campos pueda instalarse y añadirse a la pantalla de inicio desde Android, siguiendo el planteamiento de WEBLINE GT en `RESBOTv2`.

Cambios guardados en `backup-antes-limpieza`:
- Creado `public/manifest.json` con nombre `Academia Campos`, nombre corto `Academia`, `start_url: /`, `scope: /`, `display: standalone`, orientación vertical y colores de Academia (`#101827`).
- El manifiesto declara iconos PNG de 192×192 y 512×512 usando la imagen elegida por el usuario en Cloudinary (`1000110742`), con transformación de tamaño y ajuste sin recorte.
- Actualizado `public/index.html` para enlazar el manifiesto, establecer el icono de pestaña y el icono Apple touch, conservando el tema, estilos y scripts existentes.
- No se ha modificado `server.ts`: el servidor ya sirve estáticamente el contenido de `public/`, por lo que `/manifest.json` queda disponible sin ruta backend adicional.
- No se ha añadido service worker: esta fase prepara instalación/acceso directo, no funcionamiento offline.

Verificación realizada:
- Los dos archivos se han guardado en GitHub y releído desde la rama de Academia.
- La URL original de la imagen no se pudo inspeccionar visualmente desde este entorno. Se ha usado la URL Cloudinary proporcionada con formato PNG explícito y variantes 192/512.
- No se ha ejecutado compilación ni prueba de instalación en Chrome/Android.
- No se ha desplegado en Render.

Siguiente paso: el usuario debe autorizar el deploy manual de la rama `backup-antes-limpieza`; después probar en Chrome Android la opción «Instalar aplicación» o «Añadir a pantalla de inicio» y comprobar el icono. El lanzador Android puede aplicar su propia máscara circular o redondeada; no se ha recortado manualmente la imagen.


## 12. Ajuste de visibilidad y orden de Deberes (7-11-2026)

Petición del usuario:
1. Los deberes completados deben desaparecer de la vista de Leo o Mamá que los completa.
2. Papá debe conservar y seguir viendo los deberes completados.
3. Comprobar la posición de los deberes nuevos respecto a los existentes.

Cambio aplicado en GitHub:
- Archivo: `routes/homework.ts`.
- En la consulta GET `/homework`, Papá conserva el filtro opcional por estado y recibe el historial completo de Leo y Mamá.
- Para Leo y Mamá, el servidor fuerza `estado: "pendiente"`, independientemente de los filtros enviados. Así los deberes completados dejan de aparecer en su lista, pero no se borran de MongoDB y Papá los sigue viendo.
- Commit: `efc7e970ac02255b2481f2758f3fdbf4e616b479`.
- Blob SHA verificado: `f3ac272562f12dc1b98c2ccb6ad70ec27a6ae56c`.
- El archivo se volvió a leer desde GitHub y se confirmó la regla guardada.

Comprobación del orden actual:
- `public/js/homework/render.js` ordena las tarjetas por `creadoEn` descendente (más reciente primero). El deber nuevo aparece arriba de los anteriores tanto para los perfiles familiares como en la vista de Papá.
- La ruta de Papá también ordena en servidor por estado, fecha límite y creación, pero la interfaz vuelve a ordenar por fecha de creación; por tanto, el orden final visible es más reciente primero.
- No se ha cambiado el orden porque la petición era comprobarlo, no modificarlo.

Pendiente:
- Compilar TypeScript y probar funcionalmente en Render tras el despliegue manual autorizado por el usuario.
- Verificar con Leo/Mamá que al completar un deber desaparece y que Papá lo conserva en su lista.
- No se ha hecho deploy ni se ha modificado Render.

 
## 13. Diseño de casillas de respuesta en ejercicios de Deberes (7-11-2026)

Petición:
- En ejercicios con preguntas (no deberes de tipo enlace), mostrar cada pregunta en una fila y su casilla de respuesta en la fila inmediatamente inferior.
- La casilla debe ocupar todo el ancho disponible.

Cambio aplicado:
- Archivo: `public/styles.css`.
- Añadidos estilos específicos para `.homework-exercise-question`: columna vertical, etiqueta de pregunta en bloque y textarea debajo.
- Textarea con `display: block`, `width: 100%`, `max-width: 100%`, `box-sizing: border-box`, altura mínima 76px y padding/borde coherentes con el diseño.
- El cambio solo afecta a las preguntas de ejercicios dentro de Deberes; no modifica los deberes de enlace ni otros formularios.
- Commit: `f9124c5fc00021a48547be38a2807bc31e180973`.
- Blob SHA verificado: `707160fc04d5b8d4e86c86ced97176d93d0d9e05`.
- Se volvió a leer el CSS desde GitHub y se confirmó que las reglas quedaron guardadas.

Pendiente:
- Comprobar visualmente en móvil y escritorio después del despliegue manual.
- No se ha compilado ni desplegado; Render no se ha tocado.


## 14. Confirmación visible al completar ejercicios de Deberes (7-11-2026)

Petición:
- Al acertar todas las respuestas, mostrar una felicitación clara antes de que el ejercicio desaparezca de la lista del alumno.

Cambios guardados en GitHub, rama `backup-antes-limpieza`:
- `public/js/homework/actions.js`: al recibir `resultado.completado`, escribe «¡Correcto! 🎉 Has acertado todas las respuestas. ¡Ejercicio completado!» en el área de feedback del propio ejercicio y en el mensaje general. Espera 1,8 segundos antes de recargar Deberes; así el alumno puede leer la confirmación y después el ejercicio desaparece como estaba previsto.
- `public/styles.css`: el feedback de éxito se muestra en verde y negrita.
- Se conserva la validación de respuestas, el tratamiento de errores y la persistencia del completado.

Commits:
- `public/js/homework/actions.js`: `4a2752a83f9da666ba0c29449f85e1f5cec90919` (blob `afa46ee1f4cff94d7b515ceda3459479470bb20a`).
- `public/styles.css`: `f7abe6a8d8fd6dfe0a3a55ebe0648db3e8676d56` (blob `1e0a2dc2a9b7530150d0bc1bde85ffc9277d0025`).

Verificación:
- Cambios guardados mediante GitHub. Pendiente releer ambos archivos para verificar el contenido final.
- No se ha compilado ni probado visualmente o en Render.
- No se ha desplegado; Render no se ha tocado.

Siguiente paso: después del deploy manual, comprobar que el mensaje se ve durante aproximadamente 1,8 segundos y que luego desaparece el ejercicio de Leo/Mamá, mientras Papá conserva el historial.


---

## 16. Chat familiar grupal (7-11-2026)

El usuario solicita implementar primero un chat grupal compartido por los perfiles Leo, Papá y Mamá. El tutor IA queda fuera de este bloque.

### Diseño y alcance implementado

- Acceso «Chat familiar» desde la pantalla de asignaturas, disponible para cualquiera de los tres perfiles.
- Los mensajes se identifican con el perfil seleccionado (leo, papa, mama) y fecha/hora.
- Conversación común para los tres perfiles, no tres conversaciones separadas.
- Actualización automática de mensajes cada 7 segundos mientras la pantalla del chat está abierta.
- Persistencia en MongoDB, base academia_campos (o la indicada por MONGODB_DB), colección nueva e independiente family_chat_messages.
- El chat devuelve los 100 mensajes más recientes; los mensajes antiguos siguen almacenados en MongoDB.
- Límite de 1.000 caracteres por mensaje y validación de perfil en el servidor.
- Los mensajes se insertan en el DOM usando textContent, evitando interpretar texto escrito como HTML.
- El chat tiene pantalla y estilos propios; no modifica el funcionamiento de Deberes, ejercicios, ranking ni perfiles.

### Archivos creados o modificados

Creados:
- services/chatService.ts: conexión y persistencia MongoDB para la colección independiente del chat.
- routes/chat.ts: endpoints GET y POST /api/academia/chat/messages.
- public/js/chat.js: carga, envío, renderizado seguro y actualización automática.

Modificados:
- server.ts: registra las rutas nuevas.
- public/app.js: inicializa el módulo y conecta las acciones de abrir/cerrar.
- public/index.html: acceso desde la pantalla de asignaturas y nueva pantalla del chat.
- public/styles.css: estilos aislados para móvil y escritorio.
- ACADEMIA_ESTADO.md: registro de este bloque.

### Commits

- services/chatService.ts: 97fad8c83fd8220410d712b2d12e9a9d45507dd0
- routes/chat.ts: f88f899a4fba9d9065151ef37a6ba10a273c23df
- public/js/chat.js: 7a36c7b78d7f13d502bfc938e989c87a24e90c3d
- server.ts: 07fe48e919a6ba8df79c6eb3a1c7aaa9eb893344
- public/app.js: fb2f56f9ee6424dd85b3e762eb0802f0c344772c
- public/index.html: 07a5385ce323854c8eb59cb08d5fc64093a25c27
- public/styles.css: 3e20aaeecbd220f860ba248d470b6526455935ee

### Seguridad y limitaciones conocidas

- Los perfiles de Academia no requieren autenticación individual. Por tanto, cualquier persona que pueda entrar en la web y seleccionar un perfil puede enviar mensajes atribuidos a ese perfil. Esto coincide con el funcionamiento actual de la selección de perfiles y no debe confundirse con una identidad verificada.
- No se ha añadido borrado ni edición de mensajes.
- La pantalla muestra los 100 mensajes más recientes; la colección conserva el historial completo.
- No se ha añadido protección antispam avanzada ni moderación.

### Verificación

- Los siete archivos funcionales se han vuelto a leer desde GitHub en backup-antes-limpieza.
- Comprobaciones estáticas realizadas: servicio MongoDB y nombre de colección; importación y montaje de ruta; importación e inicialización del cliente; acceso y pantalla en HTML; versiones de caché; estilos; renderizado seguro con textContent; límites de 1.000 caracteres y 100 mensajes.
- Estas comprobaciones no equivalen a compilación TypeScript ni a prueba funcional.
- Compilación: pendiente.
- Prueba real con MongoDB y los tres perfiles: pendiente.
- Render: autoDeploy=yes, trigger=commit, rama backup-antes-limpieza. Los commits del chat dispararon despliegues automáticos; el build de TypeScript y el último despliegue finalizaron correctamente (live). La web y /api/academia/status responden; GET /api/academia/chat/messages respondió {ok:true,mensajes:[]} y conectó con MongoDB. No se insertaron mensajes de prueba.

### Siguiente paso

1. Ejecutar el build TypeScript y corregir solo errores relacionados con el chat.
2. Esperar a que el usuario haga el deploy manual.
3. Probar envío y recepción desde Leo, Papá y Mamá, incluida la persistencia al salir y volver a entrar.
4. Comprobar que Deberes y los ejercicios siguen funcionando.
5. Mantener el tutor IA fuera de esta fase.


---

## 17. Nueva asignatura English (7-11-2026)

El usuario solicita añadir English como quinta asignatura, siguiendo el flujo de las cuatro materias existentes.

### Cambios guardados en GitHub
- Creado `services/subjects/english.ts`: motor independiente de generación y evaluación mediante el servicio Gemini compartido y los esquemas comunes.
- Contenidos progresivos: saludos, vocabulario cotidiano, números, colores, familia, cuerpo, animales, comida, ropa, colegio, casa, días y tiempo atmosférico; estructuras básicas (verb to be, have got, can/can't, there is/there are), preposiciones y comprensión de frases/textos breves.
- Enunciados principalmente en inglés sencillo; pistas, feedback y explicaciones en español.
- Evaluación semántica: acepta equivalencias correctas y errores ortográficos menores cuando la ortografía no sea el objetivo; conserva exigencia gramatical cuando se practica una estructura.
- Registrada en `services/subjects/index.ts` y conectada a generación/evaluación en `services/aiService.ts`.
- Backend: `routes/questions.ts` acepta la clave `english` y el alias `ingles`, y etiqueta la asignatura como English.
- Frontend: `public/js/subjects.js` y `public/js/challenges.js` reconocen la clave; `public/index.html` muestra la quinta tarjeta 🇬🇧 English.
- Cada perfil utiliza automáticamente su historial independiente para English mediante la clave `perfil:english`; se conserva el límite común de 30 preguntas recientes en memoria.
- Se mantienen los niveles iniciales compartidos y el flujo común de pista, evaluación, reintentos y siguiente ejercicio. No se ha tocado Deberes, chat familiar, ranking ni las otras cuatro materias.

### Commits
- `services/subjects/english.ts`: `c6b00b7e0e42773e944909a7e60b4e33a3da9264`
- `services/subjects/index.ts`: `1dbc8676311f724b8ee9dd841182f0caeaa7fb21`
- `services/aiService.ts`: `ba38bdb8df434deb12fee35a903bc2fa52d92bbb`
- `routes/questions.ts`: `db943a5fbe19f74181c2fb43f634ef22950bd7c0`
- `public/js/subjects.js`: `eac1e0be6542447d3abb2bba9bb9c24a6470aca0`
- `public/js/challenges.js`: `c20eb07904e9de3bd538449f0ebde3195e8b96f0`
- `public/index.html`: `f49b059fa6e9a5056c7fb046d27aa067f1e4ea17`

### Verificación realizada
- Los siete archivos funcionales se han vuelto a leer desde la rama `backup-antes-limpieza`; las exportaciones, tipos, rutas, catálogo, validación frontend y tarjeta HTML muestran English integrado.
- `package.json` define el build `tsc -p tsconfig.json` y copia de `public` a `dist/public`.
- Compilación TypeScript: pendiente de confirmar mediante el build de Render.
- Prueba funcional de generación, pista, evaluación correcta/incorrecta y siguiente ejercicio: pendiente.
- Regresión de las otras cuatro materias, Deberes y chat: pendiente.

### Despliegue
- Corrección operativa: Render tiene `autoDeploy=yes`, `trigger=commit` y despliega automáticamente los commits de esta rama. Esto prevalece sobre las referencias antiguas del documento a deploy manual.
- Por tanto, los commits de English han iniciado despliegues automáticos. Comprobar el último build y su estado antes de dar la tarea por terminada.

### Siguiente paso
1. Confirmar que el último despliegue de Render termina en `live` y que el build TypeScript ha tenido éxito.
2. Probar English desde Leo, Papá y Mamá.
3. Verificar generación, pista, respuesta incorrecta, respuesta correcta y siguiente ejercicio.
4. Comprobar regresión de las cuatro materias existentes, Deberes y chat familiar.


---

## 18. Corrección de ejercicios que desaparecen al evaluar (7-11-2026)

### Problema observado
Al evaluar una respuesta, la web mostró «No se ha podido evaluar la respuesta. Este ejercicio ya no está disponible. Genera otro.» y el botón «Siguiente pregunta» quedó desactivado.

### Causa localizada
- `routes/questions.ts` guardaba los ejercicios pendientes en un `Map` en memoria del proceso.
- Un reinicio de Render o una petición atendida por otra instancia podía dejar el ID del ejercicio sin correspondencia, aunque el navegador conservara el ejercicio.
- El frontend bloqueaba «Siguiente pregunta» ante el 404 del servidor, sin ofrecer una salida para descartar el ejercicio perdido.

### Corrección aplicada
- Nuevo `services/pendingChallengeService.ts`: persiste los ejercicios pendientes en la colección MongoDB independiente `pending_challenges`, base `academia_campos` (o `MONGODB_DB` si está configurada). La solución sigue almacenada solo en el servidor.
- `routes/questions.ts`: guarda, recupera y elimina los ejercicios pendientes en MongoDB; mantiene la caducidad de dos horas y la limpieza de ejercicios caducados.
- `public/js/challenges.js`: conserva el estado HTTP del error. Si la evaluación devuelve 404 porque un ejercicio antiguo ya no existe, habilita «Siguiente pregunta» para descartarlo y continuar; no lo marca como respuesta correcta.
- No se cambia el motor de English, las demás asignaturas, Deberes, chat, perfiles ni niveles.

### Verificación
- Código guardado en GitHub y releído: pendiente de confirmar tras los commits.
- Build TypeScript: pendiente.
- Prueba funcional de evaluación y siguiente pregunta en Render: pendiente.
- Render tiene auto-deploy por commit en esta rama; guardar estos cambios iniciará el despliegue automático. No ejecutar un deploy manual adicional.

### Siguiente paso
1. Confirmar que Render termina el despliegue automático y que el build TypeScript es correcto.
2. Probar English: generar, responder incorrectamente, volver a intentar, acertar y pulsar «Siguiente pregunta».
3. Si hay un ejercicio antiguo que aún falla con 404, comprobar que ahora se puede descartar y continuar.
4. Comprobar que las demás asignaturas conservan su flujo.


---

## 19. Ilustraciones en ejercicios de English (7-11-2026)

### Alcance incorporado
- English puede generar un campo visual opcional junto al enunciado: descripción accesible y grupos de elementos identificados por emoji y cantidad.
- Se usa para ejercicios de contar objetos, reconocer animales, alimentos, colores y vocabulario cotidiano. Los ejercicios de gramática, traducción o lectura pueden seguir siendo solo texto.
- Las cantidades de la ilustración se conservan en el reto pendiente del servidor y se incluyen en el contexto privado de evaluación, para que la respuesta se corrija respecto a lo que Leo ve.
- El navegador dibuja los elementos con nodos DOM y textContent; no inserta HTML generado por Gemini. Se limita la cantidad de grupos y elementos renderizados.
- Primera fase limitada a English. No se cambia la presentación de las otras asignaturas, Deberes, chat, perfiles, niveles ni ranking.
- No se añade un proveedor de generación de imágenes ni una API de pago. La primera versión usa ilustraciones con emoji; no son fotografías ni imágenes fotorrealistas.

### Archivos modificados
- services/ai/schemas.ts: añade el campo visual opcional al esquema común.
- services/subjects/english.ts: solicita ilustraciones coherentes con la pregunta cuando aportan valor didáctico.
- routes/questions.ts: devuelve la ilustración solo en English y la añade al contexto privado de evaluación.
- public/index.html: añade el contenedor de ilustración.
- public/js/challenges.js: representa los elementos de forma segura y limpia el contenedor al cambiar de ejercicio.
- public/styles.css: estilos adaptables para la ilustración.
- ACADEMIA_ESTADO.md: registra este bloque.

### Verificación y despliegue
- Cambios guardados en GitHub en backup-antes-limpieza.
- Render tiene autoDeploy=yes para esta rama: estos commits inician despliegues automáticos. No se ha lanzado un deploy manual.
- Pendiente: confirmar build TypeScript y estado live; probar un ejercicio de contar objetos y otro ejercicio textual; comprobar que las otras asignaturas no muestran un contenedor vacío ni sufren regresiones.


## 20. Nueva asignatura Lengua (7-11-2026)

Se incorpora Lengua como asignatura independiente, siguiendo el flujo modular de las demás materias.

- Nuevo módulo `services/subjects/lengua.ts` con generación y evaluación propias.
- Contenidos alternados: comprensión lectora, ortografía, acentuación, sílabas, gramática, concordancia, sujeto y predicado, vocabulario, puntuación y expresión escrita.
- Dificultad inicial orientativa de 2.º-3.º de Primaria.
- Registrada en `services/subjects/index.ts` y conectada a `services/aiService.ts`.
- Backend `routes/questions.ts`: reconoce Lengua y la procesa como materia independiente.
- Frontend `public/js/subjects.js`, `public/js/challenges.js` y `public/index.html`: nueva tarjeta y clave de asignatura.
- El flujo existente de retos pendientes e historial reciente utiliza la clave `perfil:lengua`, separada de las demás asignaturas.
- Se conserva el visual opcional exclusivo de English; Lengua no depende de imágenes ni emojis.
- Deberes, chat, perfiles, otras asignaturas y ranking no se modifican.
- Pendiente: comprobar compilación TypeScript, despliegue automático y pruebas reales de generación/evaluación. No se declara probado hasta completar esas verificaciones.


---

## 21. Nueva asignatura Lenguaje Musical — primera implementación (8-11-2026)

El usuario aprueba comenzar la implementación de Lenguaje Musical como asignatura independiente.

### Alcance de esta primera versión
- Motor propio `services/subjects/lenguajeMusical.ts`, conectado al servicio Gemini común.
- Contenidos previstos en el prompt: sonido/silencio, duración, intensidad, altura, instrumentos, ritmo, notas, pentagrama, oído musical, composición y estilos.
- Campo opcional `audio` en el esquema de retos, con secuencias acotadas de tonos.
- El navegador genera los tonos mediante Web Audio API, sin proveedor de audio ni coste adicional. Son tonos electrónicos, no grabaciones de instrumentos.
- Botón de reproducción añadido dinámicamente a la pantalla de retos.
- Nueva tarjeta «Lenguaje Musical» y clave independiente `lenguaje_musical`.
- Se reutiliza el flujo de perfil, reto pendiente, pista, evaluación y siguiente pregunta.
- Las ilustraciones visuales opcionales usan el sistema visual actual de elementos emoji; todavía no se ha incorporado un banco de fotografías o ilustraciones reales.

### Límites y comprobaciones pendientes
- No se ha compilado TypeScript ni probado la generación/evaluación real.
- No se ha comprobado la reproducción en Android/Chrome.
- El esquema de audio debe validarse con respuestas reales de Gemini; no basta con la validación estática.
- La asignatura no se considera validada hasta probar distintos ejercicios, audio, respuestas correctas/incorrectas y continuidad.
- No se ha cambiado Deberes, chat, ranking ni perfiles.
- Render tiene auto-deploy por commit en esta rama: actualizar la rama iniciará un despliegue automático. No lanzar deploy manual.

