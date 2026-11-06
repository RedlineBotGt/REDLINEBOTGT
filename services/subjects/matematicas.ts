// ========================================
// MATEMÁTICAS
// Academia Campos
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";

import {
  ESQUEMA_RETO,
  type RetoGenerado,
  type EvaluacionReto
} from "../ai/schemas.js";

// ========================================
// INSTRUCCIONES
// ========================================

function instruccionesMatematicas(
  nivel: number
): string {
  return `
Eres el profesor de Matemáticas de Academia Campos.

Crea un ejercicio matemático original.

NIVEL:
${nivel}

CONTENIDOS:
- Sumas.
- Restas.
- Cálculo mental.
- Operaciones combinadas sencillas.
- Problemas matemáticos.
- Números de varias cifras.
- Decimales cuando corresponda.

PROGRESIÓN:
- Adapta la dificultad al nivel.
- Aumenta la dificultad gradualmente.
- Alterna operaciones y problemas.
- Evita repetir continuamente los mismos ejercicios.

REGLAS IMPORTANTES:

1. El ejercicio debe tener una única respuesta numérica.
2. Comprueba matemáticamente el resultado antes de responder.
3. No inventes resultados.
4. La solución debe comenzar obligatoriamente con:
   RESULTADO: seguido del resultado numérico exacto.
5. Después del resultado, explica el procedimiento.

PISTA:
Incluye una pista breve sin revelar el resultado.

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

// ========================================
// NORMALIZAR RESULTADOS
// ========================================

function normalizarNumero(
  valor: string
): number | null {

  const limpio = valor
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!/^-?\d+(?:\.\d+)?$/.test(limpio)) {
    return null;
  }

  const numero = Number(limpio);

  return Number.isFinite(numero)
    ? numero
    : null;
}

// ========================================
// EXTRAER RESULTADO DE LA SOLUCIÓN
// ========================================

function extraerResultado(
  solucion: string
): number | null {

  const coincidencia = solucion.match(
    /RESULTADO\s*:\s*(-?\d+(?:[.,]\d+)?)/i
  );

  if (!coincidencia) {
    return null;
  }

  return normalizarNumero(coincidencia[1]);
}

// ========================================
// EVALUAR RESPUESTA
// ========================================

export async function evaluarRespuestaMatematicas(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {

  const resultadoCorrecto =
    extraerResultado(solucion);

  if (resultadoCorrecto === null) {
    throw new Error(
      "No se ha podido identificar el resultado matemático de la solución."
    );
  }

  const resultadoAlumno =
    normalizarNumero(respuesta);

  if (resultadoAlumno === null) {
    return {
      correct: false,
      feedback: "Prueba a escribir el resultado numérico.",
      explanation: "Escribe únicamente el número de tu respuesta."
    };
  }

  const correcto =
    Math.abs(resultadoAlumno - resultadoCorrecto) < 0.0000001;

  if (correcto) {
    return {
      correct: true,
      feedback: "¡Muy bien! Has acertado.",
      explanation: solucion.replace(
        /^RESULTADO\s*:\s*/i,
        "Resultado correcto: "
      )
    };
  }

  return {
    correct: false,
    feedback: "No es correcto todavía. ¡Inténtalo de nuevo!",
    explanation: "Revisa las operaciones y vuelve a intentarlo."
  };
}