# Academia Campos — Estado vivo del proyecto

**Última consolidación:** 8 de noviembre de 2026  
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
7. No iniciar deploy manual ni modificar la configuración de Render sin autorización expresa. Antes de cada commit, comprobar el `autoDeploy` actual: si está activo, el commit dispara el despliegue automáticamente; informar al usuario y verificar su resultado.
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

Se había acordado un servicio independiente `academia-campos`, conectado a `backup-antes-limpieza`, región Frankfurt y plan gratuito. Build `npm install && npm run build`; Start `npm start`. Configuración comprobada el 8/11/2026: `autoDeploy=yes`, disparador `commit`, rama `backup-antes-limpieza`. Por tanto, cada commit en esta rama inicia un despliegue automático. No lanzar deploy manual adicional.

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



### Verificación de la primera implementación (8-11-2026, 23:10 UTC)
- Compilación TypeScript en Render: **correcta** (build del commit `2659431b3a8426234996e867f81036e93ce526b9` terminó con `buildStatus=succeeded`).
- Despliegue automático: **live** (`dep-dbnqvbu8bjmc73aisn5g`).
- Relectura de GitHub: se confirmaron el esquema de audio, las exportaciones, el enrutamiento de generación/evaluación, la tarjeta, el renderizador Web Audio y la persistencia del reto pendiente.
- Pruebas funcionales en navegador y pruebas de generación/evaluación con Gemini: pendientes. La asignatura aún no está validada.


### Incidencia de acceso a perfiles — 8-11-2026
- Causa localizada en `public/js/challenges.js`: dos secuencias `\\n` quedaron escritas literalmente en el código JavaScript, provocando un error de sintaxis al importar el módulo principal.
- Efecto: el navegador no podía cargar correctamente `app.js`; por eso no respondían los botones de selección de perfiles.
- Corrección: sustituir esas dos secuencias por saltos de línea reales. No se modifican perfiles, datos, PIN ni autenticación.
- Pendiente: confirmar compilación/despliegue automático y probar la selección de Leo, Papá y Mamá en navegador.


---

## 22. Avisos familiares (8-11-2026)

### Diseño y funcionamiento
- En la pantalla principal de selección de perfiles se muestra un listado compacto de avisos, justo debajo de los tres perfiles y alineado a la izquierda. No son tarjetas grandes; la lista puede desplazarse si acumula muchos avisos.
- Cada línea identifica a Papá como autor, muestra el destinatario (Leo, Mamá o Todos), el mensaje y la fecha.
- Papá dispone del botón «📢 Avisos» debajo de «Consultar deberes», dentro de su pantalla de asignaturas. El botón solo aparece en el perfil Papá.
- El panel permite elegir destinatario (Leo, Mamá o Todos) y publicar un mensaje de hasta 240 caracteres.
- Los avisos se guardan en MongoDB, base academia_campos (o MONGODB_DB), colección independiente family_notices. Se listan hasta 200, del más reciente al más antiguo.
- La lectura es pública para que los avisos aparezcan en la pantalla de perfiles; la creación requiere la sesión firmada de Papá usada por Deberes. No se crea un PIN ni token adicional.
- La ruta no admite autor enviado por el cliente: el servidor establece siempre autor=papa.
- El listado se representa con textContent para evitar interpretar los avisos como HTML.
- Deberes y chat familiar conservan sus rutas y lógica. Solo se exporta el middleware de sesión de Papá para reutilizarlo en la ruta de avisos.

### Archivos
- Nuevos: services/noticesService.ts, routes/notices.ts, public/js/notices.js.
- Modificados: routes/homework.ts, server.ts, public/app.js, public/index.html, public/styles.css y este estado vivo.

### Verificación pendiente
- Confirmar build TypeScript y deploy automático de Render.
- Probar lectura pública en pantalla de perfiles.
- Entrar como Papá, comprobar que el botón aparece, reutilizar la sesión PIN de Deberes y publicar avisos dirigidos a Leo, Mamá y Todos.
- Verificar que se conservan al recargar y que Deberes y chat siguen funcionando.
- No se ha realizado aún una prueba funcional en navegador.


### Ajuste visual de avisos familiares (8-11-2026)
- En el listado público, el autor se representa ahora con el icono 🔔 en lugar del texto «Papá».
- El destinatario (Leo, Mamá o Todos) se muestra en azul.
- El mensaje y la fecha mantienen su presentación y comportamiento.
- Cambios limitados a `public/js/notices.js`, `public/styles.css` y este registro.
- Pendiente: build/despliegue automático de Render y comprobación visual en móvil.

### Aviso automático al crear deberes (8-11-2026)
- Al guardar un deber nuevo, el backend crea también un aviso familiar independiente, dirigido al mismo destinatario. Editar un deber existente no genera avisos duplicados.
- El formato visual es una sola línea: icono de la asignatura, nombre de la asignatura en azul, «para» en blanco y destinatario en azul. Para Lengua se utiliza 📖, tal como se acordó en el ejemplo final.
- Iconos incluidos: Ciencias 🔬, Matemáticas 🔢, Lengua 📖, Geografía 🗺️, Historia 🏛️, Inglés/English 🇬🇧, Cultura general 🌍, Lenguaje Musical 🎼, Retos Imposibles 🕵️ y Otras 📘.
- Los avisos manuales conservan la campana 🔔, el destinatario azul y el texto original.
- Las filas no saltan de línea en móvil; si una es más larga que el ancho disponible, puede desplazarse horizontalmente.
- El aviso se guarda después de persistir el deber. Si la inserción del aviso falla, el deber sigue guardado y el error queda registrado en logs.
- Archivos modificados: `routes/homework.ts`, `public/js/notices.js`, `public/styles.css`, `public/index.html`, `public/app.js`.
- Commits de código: `b282e46c6fca0ae173456447ee54c2ba0191c625`, `dfc9c0f60b05384cd511be5d0462f97357028ff7`, `920b004453237f52087b7f00d74f1d81bf04e3fc` y los commits posteriores de caché.
- Pendiente: confirmar build y despliegue final de Render; probar creando un deber de cada asignatura relevante y comprobar icono, nombre, destinatario y presentación en móvil.
- Pendiente de decisión: el aviso independiente «🆕 Nueva asignatura: …» no tiene todavía un flujo de publicación; confirmar si Papá lo publicará desde el panel o si debe generarse al incorporar una asignatura nueva al catálogo.


### Sincronización de avisos con edición y borrado de deberes (8-11-2026)
- Cada aviso automático de deber queda vinculado al identificador del deber mediante `deberId`.
- Al editar un deber, el aviso asociado se actualiza (asignatura y destinatario) en lugar de crear otro aviso.
- Al borrar un deber, se elimina el aviso vinculado.
- Se conserva el comportamiento de avisos manuales y la creación automática al crear deberes.
- Para avisos antiguos que aún no tenían identificador, la lectura limpia los avisos huérfanos cuando ya no existe ningún deber con la misma asignatura y destinatario. Si hay varios deberes antiguos iguales, no es posible atribuir inequívocamente cada aviso legado a uno concreto.
- Archivos modificados: `services/noticesService.ts`, `routes/homework.ts`.
- Pendiente: confirmar build y despliegue automático; probar editar asignatura/destinatario y borrar un deber desde el panel de Papá.


### Gestión de avisos familiares (8-11-2026)

- El panel de Papá incluye ahora un listado de avisos publicados, con identificación de avisos manuales y avisos automáticos de deberes.
- Se puede editar el destinatario de cualquier aviso y el texto de los avisos manuales; también se puede borrar individualmente cualquier aviso, incluidos los antiguos sin `deberId`.
- El contenido de un aviso automático de deber se deriva de la asignatura del propio deber: para cambiar esa asignatura se debe editar el deber desde Deberes. Desde este panel se puede cambiar su destinatario o borrar el aviso.
- Nuevas rutas protegidas por `requierePapa`: PATCH y DELETE `/notices/:id`. El servidor valida destinatario, longitud del mensaje e identificador MongoDB.
- El listado público sigue siendo el mismo y continúa mostrando los 200 avisos más recientes.
- Se ha eliminado la limpieza automática de avisos antiguos basada en coincidencias de asignatura/destinatario: podía borrar avisos sin identificar con certeza su deber. La limpieza de avisos queda bajo control explícito de Papá.
- No se borran ni modifican avisos al cargar el listado.
- Archivos modificados: `services/noticesService.ts`, `routes/notices.ts`, `public/js/notices.js`, `public/index.html`, `public/styles.css`.
- Commits de implementación: `f06225307dd5df98fd47456137c4b70f6c917dc9`, `f74d246943576101b629a7038ad1b2c55d1caae3`, `6d8ef3ec309fdf335d524db2b8535d5b149973f4`, `d22e9b671a042e94f710e4788c0bb1e8a97ad7f2`, `0594bda7ee039eb0a486c98bf1119b441b638450`.
- Pendiente: confirmar compilación y despliegue automático en Render; probar edición/borrado de aviso manual, edición de destinatario de aviso automático y borrado de un aviso legado sin ID. No se ha realizado todavía una prueba funcional con MongoDB.


### Corrección de la interfaz de gestión de avisos (8-11-2026)

- Incidencia reportada: no aparecían los botones de edición/borrado y el aviso antiguo seguía en el listado público.
- Causa raíz confirmada en el HTML: el módulo JS ya intentaba renderizar en `#notices-admin-list`, pero ese contenedor no se había insertado dentro de `#notices-admin`. Por tanto, `pintarGestionAvisos()` terminaba sin mostrar controles.
- Corrección: añadido el bloque «Avisos publicados» con `id="notices-admin-list"` dentro del panel de Papá en `public/index.html`.
- Verificación de código: el HTML contiene el contenedor y `public/js/notices.js` contiene el render de la lista y las acciones PATCH/DELETE. El build de Render terminó con «Build successful» y la instancia nueva arrancó con «ACADEMIA CAMPOS ARRANCADA» y «Archivos web disponibles».
- Commit de corrección: `d9fe53b83d67e962f97e17b644e33489509899f9`.
- Pendiente de prueba desde la interfaz autenticada: confirmar que se muestra el listado, borrar el aviso antiguo y comprobar que desaparece también del listado público. No se ha borrado ningún aviso desde el backend ni se ha alterado la colección.


## 11. Acceso de Papá mediante PIN (8 de noviembre de 2026)

### Decisión funcional
- La confirmación del PIN se solicita al seleccionar el perfil **Papá**, no al entrar en «Consultar deberes».
- La sesión autenticada habilita tanto «Consultar deberes» como «📢 Avisos».
- Cambiar a Leo o Mamá cierra la sesión administrativa de Papá.
- Cada nueva selección del perfil Papá vuelve a pedir PIN; navegar entre funciones dentro de la misma selección conserva la sesión.
- El botón «📢 Avisos» solo se muestra cuando el perfil actual es Papá y el PIN se ha validado.

### Cambios guardados en GitHub
- `public/index.html`: se trasladó el bloque de PIN desde la pantalla de Deberes a la pantalla de asignaturas/perfil. El formulario conserva sus IDs y el mismo endpoint.
- `public/js/homework.js`: al cambiar al perfil Papá, cierra cualquier token anterior y muestra el acceso PIN; al validar, oculta el acceso y emite `academia:papa-authenticated`, sin forzar la navegación a Deberes. Si la sesión expira, devuelve a la pantalla del perfil y vuelve a pedir PIN.
- `public/js/notices.js`: muestra el acceso a gestión de avisos únicamente con perfil Papá autenticado; oculta el panel al cambiar de perfil o expirar la sesión.
- Commits:
  - `88004afd4ef7f710d82eaadc7df7209783957c90` — mueve el formulario PIN a la pantalla del perfil.
  - `cfaf7cf8fdab30df40dd7a4401141a85a910137a` — centraliza la autenticación al seleccionar Papá.
  - `36597b76e8e686f32e931eac7ba7df13ab44caab` — protege el botón de Avisos con la sesión autenticada.

### Comprobaciones realizadas
- El HTML contiene una única instancia de `#homework-login`, situada dentro de `#subjects-screen`.
- El módulo de Deberes escucha el cambio de perfil y el evento de autenticación.
- El módulo de Avisos consulta el token y escucha autenticación y expiración.
- Servicio Render comprobado: rama `backup-antes-limpieza`, `autoDeploy=yes`, disparador `commit`, Frankfurt. Los commits anteriores han activado el flujo automático; no se ha iniciado un deploy manual.

### Incidencia detectada y corrección adicional
- El usuario informó que el PIN no aparecía al seleccionar Papá.
- Causa raíz: `menu.js` emite `academia:perfil-cambiado` sobre `document`, pero `homework.js` escuchaba ese evento sobre `window`. El evento no llegaba al listener, por eso no se mostraba el PIN.
- Corregido en commit `7761cf2defdbe6cdd348eb707a9ad21f75ac9e7c`: el listener ahora está registrado en `document`, igual que el emisor.

### Pendiente
- Esperar/verificar el deploy automático del último commit.
- Probar en navegador móvil: seleccionar Papá → introducir PIN → comprobar que aparecen «Consultar deberes» y «📢 Avisos» sin volver a pedir PIN; cambiar a Leo/Mamá y volver a Papá debe solicitarlo de nuevo.
- Verificar también que un PIN incorrecto mantiene el aviso de error y no habilita las funciones administrativas.


### Segunda corrección del acceso PIN (8/11/2026)
- El usuario comprobó que seguía pudiendo entrar sin PIN. Se confirmó que el evento de cambio de perfil no era una protección suficientemente robusta para el selector.
- `menu.js` importa directamente `cerrarSesionDeberes()` y `mostrarAccesoPapa()`. Cada selección de perfil cierra primero cualquier token anterior; después notifica el cambio para actualizar la visibilidad de Avisos; si el perfil es Papá, muestra el PIN directamente.
- Se renovó la caché de `app.js` y del módulo `menu.js` (`app.js?v=6`, `menu.js?v=2`) para evitar reutilizar el selector anterior en el navegador.
- Commits de esta corrección: `3f03d67cb76742353598ad16218e99a3bf402d64`, `2e9ba11dab0c5e122f11bd8e1746c8afe1ca92bf`, `fe1dc0d2bda6514920ed0638a6acee08dfe4e919`, `5d9a449032d58c99cd28c018fd6c37d1eb8322bb`.
- Pendiente: esperar el despliegue automático de estos últimos commits y probar en navegador real; no considerar cerrada la incidencia hasta que el PIN aparezca al seleccionar Papá y las funciones administrativas queden ocultas antes de autenticar.


### Rediseño del acceso PIN como paso independiente (8-11-2026)
- Incidencia observada por el usuario: el PIN aparecía mezclado con asignaturas; era posible entrar en asignaturas antes de autenticar; el botón Deberes no respondía como se esperaba y Avisos no aparecía hasta después de una secuencia confusa; Chat quedaba accesible.
- Decisión funcional confirmada: al seleccionar Papá, la aplicación muestra exclusivamente una pantalla de PIN. No deben aparecer asignaturas, Consultar deberes, Avisos ni Chat antes de validar.
- Se ha movido el formulario PIN a una pantalla propia `#papa-auth-screen`, fuera de `#subjects-screen`. Tiene botón «Volver a perfiles».
- `menu.js`: al seleccionar cualquier perfil cierra primero la sesión previa; para Papá muestra solo la pantalla PIN; para Leo/Mamá muestra directamente sus asignaturas. Al volver a perfiles se cierra la sesión.
- `homework.js`: `mostrarAccesoPapa()` oculta todas las pantallas y muestra solo la pantalla PIN. Tras recibir un token válido, oculta el PIN y muestra `#subjects-screen`; entonces se emite `academia:papa-authenticated` para que aparezca Avisos. El flujo de Deberes comprueba el token antes de habilitar gestión.
- Se actualizaron versiones de caché: `app.js?v=7`, `menu.js?v=3`, `homework.js?v=2`.
- Commits de código: `a258e14c53385c0fb233118981b64b2df7f682a4`, `d87b60674b5ca05eafd1ddc94edde096e293a9ee`, `b6c93420bad85e6e7e5a34e901836a2ab694e885`, `ae182e37b21e00298d26ad730ced22d77f379b21`.
- Verificación estática tras releer GitHub: una sola pantalla PIN, un solo formulario, el formulario ya no está dentro de asignaturas, y las versiones nuevas de módulos están referenciadas correctamente.
- Render: AutoDeploy activado. El deploy del commit `a258e14c53385c0fb233118981b64b2df7f682a4` estaba en `update_in_progress` y el commit final de versiones `ae182e37b21e00298d26ad730ced22d77f379b21` estaba en cola al registrar esta nota.
- Pendiente obligatorio: esperar a que el último código quede LIVE y probar en navegador real la secuencia Papá → solo PIN → PIN correcto → perfil completo con Deberes, Avisos y Chat; PIN incorrecto → permanecer en pantalla PIN; volver a perfiles → sesión cerrada. No declarar resuelta la incidencia hasta completar estas pruebas.


## 23. Nueva asignatura Science (8-11-2026)

El usuario aprueba incorporar **Science** como una única asignatura nueva. El nombre visible será exclusivamente «Science»; no se añade una tarjeta llamada «Ciencias Naturales».

### Alcance
- Nuevo motor independiente `services/subjects/science.ts` para ciencias naturales, con enunciados sencillos en inglés y explicaciones/feedback en español.
- Contenidos alternados: seres vivos, plantas, animales, cuerpo humano, sentidos, salud, alimentación, materia, agua, aire, clima, Tierra y espacio, fuerzas, luz, sonido, energía y ecosistemas.
- Generación, pista, evaluación y siguiente pregunta mediante el flujo común de Academia.
- Clave propia `science`, con historial aislado por perfil y asignatura (`leo:science`, `papa:science`, `mama:science`).
- Disponible en los tres perfiles; cada perfil conserva su propio historial.
- No se añade Science al selector de Deberes: esta solicitud incorpora una asignatura de ejercicios, no una categoría nueva de deberes.
- No se modifican Deberes, avisos, chat, PIN, perfiles, niveles ni ranking.

### Archivos modificados
- Nuevo: `services/subjects/science.ts`.
- Modificados: `services/subjects/index.ts`, `services/aiService.ts`, `routes/questions.ts`, `public/js/subjects.js`, `public/js/challenges.js`, `public/index.html` y este estado vivo.
- Se actualizó la caché de la aplicación en `public/index.html` de `app.js?v=7` a `app.js?v=8`.

### Commits de implementación
- `4f9f5e181b8f0067982a73caf01143b3df0ff2db`: motor Science.
- `3c471f792928af580a7db53b5089c5f1f11adaa8`: índice de asignaturas.
- `ac5019fe63b81407f0f0b1eadd1e040ba53b5694`: servicio principal de IA.
- `e3b3cbb99cf2f10a46f015abb3bc1df55547bd75`: API de preguntas.
- `66b912d26bbf5373399c88ea9966cafba8bbe898`: catálogo de asignaturas del navegador.
- `e1546367bc333b29b896d3831ac697bfe0beda65`: validación de asignatura en ejercicios.
- `1d45c3fe4f8043ecdbe5034882a2161151e75fe1`: tarjeta Science y caché.

### Verificación pendiente
- Confirmar build TypeScript y despliegue automático de Render.
- Probar Science en Leo, Papá y Mamá; generar preguntas diferentes, pedir pistas, evaluar respuestas correctas e incorrectas y avanzar al siguiente ejercicio.
- Confirmar que el nombre visible sea «Science» y que las otras asignaturas y funciones no cambien.
- No declarar Science validada hasta completar pruebas funcionales reales.


## 24. Etiqueta futura BATALLA DE GENIOS (8-11-2026)

El usuario solicita mostrar en el menú principal, separada de los perfiles por una línea sutil, la etiqueta **🏆 BATALLA DE GENIOS**. Será el futuro ranking/competición.

- La etiqueta queda visible debajo de las tarjetas de Leo, Papá y Mamá.
- Es solo informativa y está desactivada: no tiene enlace, botón ni acción, por lo que no abre ninguna pantalla ni modifica datos.
- Separación con línea horizontal tenue y estilo visual atenuado.
- No implementar todavía ranking, puntuaciones, clasificaciones, tablas ni persistencia.
- Archivos modificados: `public/index.html` y `public/styles.css`; versión CSS incrementada a `styles.css?v=8`.
- Commits: `0c3e19fcd741421a4874007629d6eb2af88b3a69` (HTML), `b5e11802c2d0c5bb9114770fc5cb0dcab4a1b339` (CSS).
- Pendiente: confirmar AutoDeploy LIVE y comprobar visualmente en móvil que aparece debajo de los perfiles, separado sutilmente, sin ser interactivo.


## 25. Accesos del perfil: IA y cuadrícula 2×2 (8-11-2026)

El usuario pide un cuarto acceso llamado **🤖 IA** dentro de su perfil (perfil de Papá), con apariencia igual a Avisos y Chat. Por ahora el botón es únicamente visual y permanece desactivado; esperar instrucciones del usuario antes de asignarle comportamiento.

### Diseño acordado
- Cuatro botones organizados en cuadrícula de dos columnas: dos arriba y dos abajo.
- «Consultar deberes» deja de usar el fondo azul y comparte el fondo `var(--panel-light)` con Avisos y Chat.
- Cada botón ocupa una sola columna (aproximadamente la mitad del ancho total disponible).
- IA visible pero desactivado, sin navegación ni acción.
- No implementar todavía ninguna función de IA.

### Código y despliegue
- El botón IA ya estaba añadido en `public/index.html` por el commit `c91ed385ead3380d97b924e38c4e93243c5d394a`.
- La cuadrícula y estilos unificados están en `public/styles.css`, commit `19cfde411c8f55d8e72c0f67292ee5ed6b2ca542`.
- El commit de estilos compiló correctamente; el despliegue Render `dep-dbo8g20qr7gs73ap24gg` seguía en `update_in_progress` en la última consulta.
- Pendiente: confirmar Render LIVE y comprobar en móvil la distribución 2×2, el color común y el botón IA desactivado.


## 26. Historial de ejercicios IA de Leo (8-11-2026)

El usuario aprueba activar el acceso **🤖 IA** como una vista de consulta para llevar el recuento de ejercicios que Leo resuelve mediante el motor de IA. No es un chat ni modifica la generación de ejercicios.

### Diseño y reglas
- El acceso IA se muestra únicamente dentro del perfil de Papá, después de superar el PIN.
- Abre una pantalla independiente titulada «Historial de IA · Leo», con botón para volver al perfil.
- Cada fila representa un ejercicio IA que Leo ha resuelto correctamente: asignatura, enunciado y número de intentos.
- Acierto en el primer envío = 1; segundo envío = 2; tercero = 3, etc.
- Cada ejercicio tiene su propio registro, aunque se repita el mismo enunciado en otro momento.
- Los intentos se cuentan cuando el servidor ha evaluado una respuesta. Los errores de conexión/evaluación no cuentan.
- Solo se muestran ejercicios IA de Leo. No aparecen Mamá, Papá ni ejercicios/deberes creados desde el panel de Deberes.
- Los registros se guardan en MongoDB, colección independiente `ai_exercise_history`, base `academia_campos` (o `MONGODB_DB`).
- Solo se muestra el registro cuando el ejercicio se acierta; un ejercicio abandonado no aparece en la lista.
- El endpoint de consulta requiere el mismo token de sesión de Papá utilizado por Deberes y Avisos.
- Se muestran hasta 500 ejercicios, del más reciente al más antiguo.

### Archivos
- Nuevo: `services/aiExerciseHistoryService.ts`, `public/js/aiHistory.js`.
- Modificados: `routes/questions.ts`, `public/index.html`, `public/styles.css`, `public/app.js`, `public/js/menu.js` y este estado vivo.
- La versión de caché de estilos pasa a `styles.css?v=10`; la aplicación a `app.js?v=9`; el módulo del menú a `menu.js?v=4`; nuevo módulo `aiHistory.js?v=1`.

### Commits de implementación
- `9932e6ca92efcea801680719dbabb8826fc55690`: persistencia de intentos e historial.
- `bc741ff19226e4878c65ea11fcc308b895e14370`: integración con evaluación IA.
- `6ac537679718f38472d798fd917320c47cca528c`: protección del endpoint con PIN de Papá.
- `a56829529d728ef4c37cd6c88179c57421b008eb`: pantalla de historial.
- `c394d41bff3ca07c70d49fdab06562efe2cba9d0`: inicialización del módulo.
- `c316cb41f177d0bb36fa78c870cad5ab79939090`: visibilidad del acceso solo para Papá.
- `fe1d19444c75abf6fcf750174a68f7be1fe565dc`: estilos de la lista.
- `68d31a0b693db486070001c5043bae8bc4f15020`: módulo de interfaz.
- `64499f44de4ee7778d4c62f965e1a6aa785fa12e`: renovación de caché del menú.
- `85695e79246cea32de12bd1077942fbe292db213`: consulta del historial con token de Papá.

### Verificación pendiente
- Confirmar AutoDeploy y build LIVE de Render.
- Probar un ejercicio de Leo acertado a la primera (1), otro tras un fallo (2) y otro tras dos fallos (3).
- Comprobar que los registros aparecen una sola vez y permanecen tras recargar.
- Verificar que Papá ve el acceso después del PIN, que Leo/Mamá no lo ven y que el endpoint rechaza peticiones sin sesión.
- Confirmar que Deberes, Science, chat, avisos, PIN y navegación siguen funcionando.
- El historial empieza a contar desde esta implementación; no se reconstruyen ejercicios anteriores porque el sistema previo no guardaba un registro persistente de intentos por pregunta.


---

## 27. Nuevo tipo de deber: Ejercicio con imágenes (8-11-2026)

### Alcance
- Nuevo tipo independiente `ejercicio_imagen`, visible como «Ejercicio con imágenes». Los tipos «Enlace» y «Ejercicio con preguntas» se conservan.
- El formulario ofrece título, descripción, asignatura, destinatario, fecha límite, preguntas y selección múltiple de imágenes desde la galería móvil.
- Formatos admitidos: JPG/JPEG, PNG y WebP. Máximo 5 imágenes por ejercicio y 5 MB por archivo.
- Las imágenes se guardan en MongoDB GridFS (`homework_images`); el documento del deber conserva solo metadatos e identificadores.
- El servidor valida la firma binaria real del archivo además del MIME.
- Leo y Mamá ven las imágenes y responden a las preguntas. Las respuestas correctas siguen ocultas y se reutiliza el motor de corrección existente.
- El ejercicio se completa únicamente al acertar todas las respuestas.
- Al cambiar el tipo de deber o eliminarlo, se borran las imágenes asociadas.
- No se añade API externa, proveedor de imágenes ni dependencia adicional.

### Archivos modificados
- `services/homeworkService.ts`, `routes/homework.ts`.
- `public/js/homework/api.js`, `forms.js`, `render.js`, `actions.js`, `homework.js`.
- `public/app.js`, `public/index.html`, `public/styles.css`.
- Este estado vivo.

### Verificación y despliegue
- Commit único de implementación: `6666545893dd1d83d8bc36405eae3eed0f193eda`.
- Build TypeScript de Render: **correcto**, evento `build_ended` con `buildStatus=succeeded` el 8-11-2026 a las 15:06 UTC.
- Despliegue automático: **LIVE**, `dep-dbo8vkq9lscs73co80l0`, finalizado el 8-11-2026 a las 15:06:32 UTC.
- Logs de arranque: `[OK] ACADEMIA CAMPOS ARRANCADA`, servidor HTTP escuchando y rutas de Deberes registradas.
- Prueba funcional pendiente desde Android: crear un ejercicio con imágenes, comprobar su visualización y corrección, editarlo y eliminarlo.
- No declarar la función validada hasta completar esas pruebas.


### Corrección del formulario de ejercicios con imágenes (8-11-2026)
- Se detectó que el HTML incluía el selector de archivos, pero `actualizarApartadoPreguntas()` seguía tratando únicamente el tipo `ejercicio`; por eso el grupo de imágenes permanecía oculto y el texto seguía indicando «Enlace o instrucciones».
- Corregido `public/js/homework/forms.js`: al seleccionar `ejercicio_imagen` se muestran el selector múltiple de imágenes y las preguntas, y el campo de texto pasa a ser «Descripción del ejercicio».
- Añadida selección desde galería, validación de máximo 5 imágenes de hasta 5 MB, vista previa y subida a la ruta de imágenes del deber al guardar.
- Actualizada la versión de importación de `forms.js` para invalidar caché del navegador.
- Build TypeScript de Render correcto y servidor arrancado.
- Despliegue LIVE: `dep-dbo9n0vj2his73f96so0`, commit `5c222641aec0ef2b848eac4ea126fa185a4fe783`, 8-11-2026 15:57:03 UTC.
- Pendiente prueba manual desde Android de selección de imagen, guardado, visualización y corrección de preguntas.


## 28. Avisos automáticos de mensajes nuevos del chat (8-11-2026)

### Decisión funcional
- Cada mensaje nuevo guardado en el chat familiar genera un aviso persistente en la colección `family_notices`.
- El aviso no incluye vista previa ni texto del mensaje: solo «Nuevo mensaje de Leo», «Nuevo mensaje de Papá» o «Nuevo mensaje de Mamá».
- Se muestra como aviso familiar compacto con icono de chat y fecha; no se presenta como aviso manual de Papá.
- El aviso se crea al guardar el mensaje, no depende de que el destinatario tenga abierto el chat ni de su sondeo cada 7 segundos.
- Se usa el identificador del mensaje para que la creación del aviso sea idempotente y no duplique el mismo aviso si se repite la operación.
- Los avisos automáticos de chat no se pueden editar desde la gestión de Papá, pero sí borrar.
- Se conservan intactos los mensajes y la visualización del chat, los avisos manuales y los avisos automáticos de deberes.

### Archivos modificados
- `routes/chat.ts`: al guardar cada mensaje, solicita crear su aviso automático.
- `services/noticesService.ts`: añade la creación idempotente de avisos de chat.
- `public/js/notices.js`: representa el aviso sin vista previa y lo distingue en la gestión.
- `public/app.js`: renueva la caché del módulo de avisos.

### Verificación y despliegue
- Render Academia Campos comprobado antes del cambio: rama `backup-antes-limpieza`, `autoDeploy=yes`, disparador `commit`. El guardado en GitHub inicia despliegue automático; no se lanza deploy manual.
- La compilación TypeScript y la prueba funcional de extremo a extremo quedan pendientes de resultado de Render y de prueba con dos perfiles.
- Prueba necesaria: enviar desde un perfil, comprobar en Avisos el texto genérico con el nombre del emisor y verificar que el contenido del mensaje nunca aparece en el aviso; repetir con los tres perfiles y comprobar que no se generan duplicados.



## 29. Estudio musical libre y metrónomo (8-11-2026)

### Alcance implementado
- Dentro de la asignatura existente «Lenguaje Musical», antes de las preguntas se ofrecen dos opciones: «¿Quieres tocar?» y «¿Quieres preguntas?».
- «Preguntas» conserva el motor actual y su historial; la nueva opción de tocar no genera ejercicios ni altera datos de progreso.
- Estudio musical independiente con cinco instrumentos exactos: piano, clarinete, trompeta, guitarra y batería.
- Piano con dos octavas de teclas blancas y negras, nombres de notas en las teclas; la distribución se adapta al ancho sin desplazamiento horizontal (una octava en móvil vertical y dos en horizontal/tablet).
- Batería con cuatro pads táctiles: bombo, caja, charles y tom.
- Sonido generado localmente mediante Web Audio API; no se añaden proveedores, claves, APIs ni dependencias de pago.
- Metrónomo integrado: velocidad regulable de 40 a 200 BPM (inicial 100), compases 2/4, 3/4, 4/4 y 6/8, indicador visual y acentos en el primer pulso y en el cuarto pulso de 6/8.
- El metrónomo se puede iniciar/detener y reinicia su conteo al cambiar de compás.
- No se modifica el backend, Gemini, MongoDB, Deberes, chat, avisos, perfiles ni PIN.

### Archivos
- Nuevo: `public/js/musicStudio.js`.
- Modificados: `public/index.html`, `public/styles.css`, `public/js/menu.js`, `public/app.js`.
- Caché inicial: estilos `v=12`, aplicación `v=11`, módulo musical `v=1`.
- Este estado vivo actualizado.

### Verificación pendiente
- Revisar que Render compile y despliegue automáticamente el commit.
- Probar desde tablet y móvil: entrada en Lenguaje Musical, acceso a preguntas y regreso; abrir piano, cambiar los cinco instrumentos, tocar notas/pads; comprobar metrónomo en los cuatro compases y cambiar BPM mientras funciona.
- La síntesis de audio está generada por navegador y no son grabaciones de instrumentos reales; comprobar que el timbre resulta adecuado en el dispositivo de Leo.
- No declarar validación funcional hasta prueba real del usuario.


## 30. Piano adaptable sin desplazamiento horizontal (8-11-2026)

- Se elimina el desplazamiento horizontal del teclado: las teclas se ajustan al ancho disponible.
- En móvil en vertical se muestra una octava completa, con teclas amplias y notas visibles.
- En horizontal y en tablet/desktop se muestran las dos octavas completas simultáneamente.
- Las teclas negras se centran sobre los límites correctos entre teclas blancas, independientemente del ancho.
- En horizontal se compactan los márgenes y la altura del teclado para aprovechar mejor la pantalla; el metrónomo permanece debajo.
- Se conserva el diseño, los cinco instrumentos, sus sonidos y el funcionamiento del metrónomo. No se modifica el motor de preguntas ni ningún otro módulo.
- Archivos modificados: `public/styles.css`, `public/js/musicStudio.js`, `public/index.html`, `public/app.js` y este estado.
- Caché: estilos `v=13`, módulo musical `v=2`.
- Pendiente comprobar visual y táctilmente en el dispositivo real de Leo; el despliegue/build no sustituye esa prueba.
