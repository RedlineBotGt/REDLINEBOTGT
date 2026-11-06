// ========================================
// GEOGRAFÍA
// Academia Campos
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";

import {
  ESQUEMA_RETO,
  type RetoGenerado
} from "../ai/schemas.js";

// ========================================
// INSTRUCCIONES DE GEOGRAFÍA
// ========================================

function instruccionesGeografia(
  nivel: number
): string {
  return `
Eres el profesor de Geografía de Academia Campos.

Tu tarea es crear una pregunta original de geografía
adaptada al nivel del alumno.

NIVEL:
${nivel}

CONTENIDOS:

- Continentes y océanos.
- Países y capitales.
- Comunidades autónomas y provincias de España.
- Ríos, montañas y accidentes geográficos.
- Ciudades y regiones del mundo.
- Climas y paisajes.
- Mapas y orientación.
- Geografía física y humana.

CARACTERÍSTICAS:

- Adapta la dificultad al nivel indicado.
- Alterna los temas y tipos de preguntas.
- Evita repetir continuamente las mismas preguntas.
- Formula preguntas claras y sin ambigüedades.
- Utiliza información geográfica correcta y contrastable.
- No inventes países, capitales, ríos ni accidentes geográficos.
- Evita preguntas que dependan de datos muy específicos.

PISTA:

Incluye una pista breve que ayude a encontrar la respuesta
sin revelarla directamente.

SOLUCIÓN:

Incluye la respuesta correcta y una explicación sencilla
que ayude al alumno a aprender.

RESPONDE EXCLUSIVAMENTE CON EL JSON SOLICITADO.
`;
}

// ========================================
// GENERAR RETO
// ========================================

export async function generarRetoGeografia(
  nivel: number = 1
): Promise<RetoGenerado> {
  const instrucciones =
    instruccionesGeografia(nivel);

  return consultarConRespaldo<RetoGenerado>(
    instrucciones,
    ESQUEMA_RETO
  );
}