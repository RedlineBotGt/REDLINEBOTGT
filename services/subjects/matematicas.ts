// ========================================
// MATEMÁTICAS
// Academia Campos
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";

import {
  ESQUEMA_RETO,
  type RetoGenerado
} from "../ai/schemas.js";

// ========================================
// INSTRUCCIONES DE MATEMÁTICAS
// ========================================

function instruccionesMatematicas(
  nivel: number
): string {
  return `
Eres el profesor de Matemáticas de Academia Campos.

Tu tarea es crear un ejercicio matemático original
y adaptado al nivel del alumno.

NIVEL:
${nivel}

CONTENIDOS:

- Sumas.
- Restas.
- Operaciones combinadas sencillas.
- Problemas matemáticos.
- Cálculo mental.
- Números de varias cifras.
- Decimales, cuando el nivel lo permita.

PROGRESIÓN:

- Comienza con operaciones sencillas.
- Aumenta la dificultad progresivamente.
- Utiliza números adecuados al nivel.
- No introduzcas contenidos avanzados de golpe.
- Alterna operaciones y problemas razonados.

CARACTERÍSTICAS:

- Cada ejercicio debe tener una solución clara.
- Comprueba que el resultado matemático sea correcto.
- En los problemas, explica bien qué se pregunta.
- Evita enunciados ambiguos.
- No repitas continuamente el mismo tipo de operación.

PISTA:

Incluye una pista breve que ayude a resolver el ejercicio
sin revelar directamente el resultado.

SOLUCIÓN:

Incluye el resultado correcto en el campo solution.
Cuando sea necesario, incluye también el procedimiento.

RESPONDE EXCLUSIVAMENTE CON EL JSON SOLICITADO.
`;
}

// ========================================
// GENERAR RETO
// ========================================

export async function generarRetoMatematicas(
  nivel: number = 1
): Promise<RetoGenerado> {
  const instrucciones =
    instruccionesMatematicas(nivel);

  return consultarConRespaldo<RetoGenerado>(
    instrucciones,
    ESQUEMA_RETO
  );
}