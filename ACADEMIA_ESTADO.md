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
- Asignaturas visibles: Cultura general, Matemáticas y Geografía.
- Cultura general conserva internamente la clave histórica `lateral`.
- Cultura general es la base funcional que debe preservarse.
- Matemáticas ya está habilitada en los validadores del frontend y backend; su generador/evaluador está separado en su propio módulo. Pendiente probar generación y evaluación reales tras el despliegue.
- Geografía debe permanecer desactivada en la experiencia de ejercicios hasta que se autorice y se complete su implementación.
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
- `services/subjects/culturaGeneral.ts`: prompt y evaluación de Cultura general.
- `services/subjects/matematicas.ts`: generación matemática y evaluación numérica.
- `services/subjects/geografia.ts`: módulo de generación preparado, pero la asignatura sigue bloqueada en la interfaz/API y no dispone de evaluación completa.

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

- Clave interna: `lateral`; el frontend puede enviar `cultura` como alias.
- Debe conservar el comportamiento previo que ya funcionaba.
- Prompt orientado a razonamiento, curiosidad, pensamiento lateral, lógica, naturaleza, ciencia y conocimientos generales.
- Un solo ejercicio nuevo, adecuado al nivel, con enunciado, pista, solución y categoría.
- La evaluación debe valorar el significado, no exigir palabras exactas, y devolver corrección, feedback y explicación.
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
- `geografia` -> mantener bloqueada con mensaje propio.
- Cualquier otra clave -> error de selección no válida.
- El log de recepción muestra la asignatura seleccionada.

Commit: `0e2beb0630e15cc38b303654f0ac78366cf8e3de`.
Blob SHA verificado: `e2abf69b07f3de388e5fc100ec67ee29972f4894`.

### Bloqueo B — backend

Archivo: `routes/questions.ts`.

La función `obtenerAsignatura()` solo reconoce Cultura general y devuelve `null` para Matemáticas. El endpoint `POST /question` responde que solo está disponible Cultura general. El endpoint `POST /answer` usa el mismo validador y también rechaza Matemáticas.

Corrección aplicada directamente en GitHub:
- Reconoce `matematicas` y `matemáticas` como `matematicas`.
- Mantiene `geografia` rechazada.
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
6. Confirmar que Geografía continúa bloqueada.
7. Confirmar que Deberes y la navegación no han sufrido regresiones.
8. Ejecutar compilación TypeScript y pruebas disponibles antes de autorizar cualquier despliegue.

## 8. Decisiones que no deben reabrirse sin motivo

- Academia vive en `backup-antes-limpieza`, separada de `main`.
- Mantener el proyecto actual; no crear otro repositorio ni otro proyecto ChatGPT.
- No reconstruir toda la web para modularizar la IA.
- Separar motor Gemini común y módulos específicos por asignatura.
- Cultura general conserva su identidad y lógica; la clave histórica `lateral` se mantiene por compatibilidad.
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

## 11. Protocolo de continuidad para futuras sesiones

Al retomar Academia Campos:
1. Leer este archivo primero.
2. Consultar la rama `backup-antes-limpieza` y el estado real de los archivos relacionados con la tarea.
3. Comparar con el registro de cambios y corregir cualquier dato obsoleto.
4. Continuar desde el siguiente paso pendiente; no reiniciar la revisión general.
5. Actualizar este archivo al cerrar cada bloque de trabajo.

**Regla de oro:** mantener lo que funciona, tocar solo lo necesario y no desplegar sin permiso.
