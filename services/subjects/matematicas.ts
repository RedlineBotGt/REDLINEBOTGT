
import { consultarConRespaldo } from "../ai/gemini.js";

import {
  ESQUEMA_RETO,
  type RetoGenerado,
  type EvaluacionReto
} from "../ai/schemas.js";

// ========================================
// GENERACIÓN DE EJERCICIOS
// ========================================

const MAX_HISTORIAL_EJERCICIOS = 25;
const MAX_INTENTOS_GENERACION = 4;
const historialEjercicios = new Map<number, string[]>();

function normalizarEnunciado(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/\\s+/g, " ")
    .trim();
}

function instruccionesMatematicas(
  nivel: number,
  recientes: string[],
  variacion: string
): string {
  return `
Eres el profesor de Matemáticas de Academia Campos.

Crea un ejercicio matemático original y adecuado
al nivel indicado.

NIVEL DEL ALUMNO: ${nivel}
CÓDIGO DE VARIACIÓN DE ESTA PETICIÓN: ${variacion}

EJERCICIOS RECIENTES QUE NO DEBES REPETIR:
${recientes.length ? recientes.map((p, i) => `${i + 1}. ${p}`).join("\\n") : "Todavía no hay ejercicios anteriores."}

CONTENIDOS:
- Sumas.
- Restas.
- Multiplicaciones.
- Divisiones exactas.
- Cálculo mental.
- Operaciones con números decimales.

REGLAS OBLIGATORIAS:

1. Crea un único ejercicio.
2. Debe tener una respuesta numérica única.
3. La operación debe aparecer explícitamente en el enunciado.
4. Incluye una línea con este formato exacto:

OPERACIÓN: 27 + 15

5. La operación debe corresponder exactamente
   con lo que se pregunta en el enunciado.
6. Comprueba el resultado antes de responder.
7. En solution, comienza obligatoriamente con:

RESULTADO: 42

8. Después del resultado, explica brevemente
   cómo se resuelve la operación.
9. Incluye una pista breve que no revele la respuesta.
10. Alterna operaciones y evita repetir ejercicios típicos.\n11. No reutilices ningún enunciado ni operación de la lista de ejercicios recientes.\n12. Cambia los números y el contexto; el código de variación debe ayudarte a crear un ejercicio distinto.\n13. No copies literalmente ningún ejercicio anterior.

Devuelve exclusivamente el JSON solicitado.
`;
}

// ========================================
// CÁLCULO SEGURO DE OPERACIONES
// ========================================

interface Operacion {
  numero1: number;
  operador: string;
  numero2: number;
}

function extraerOperacion(pregunta: string): Operacion | null {
  const coincidencia = pregunta.match(
    /OPERACIÓN\s*:\s*(-?\d+(?:[.,]\d+)?)\s*([+\-*/×÷])\s*(-?\d+(?:[.,]\d+)?)/i
  );

  if (!coincidencia) {
    return null;
  }

  const numero1 = Number(coincidencia[1].replace(",", "."));
  const numero2 = Number(coincidencia[3].replace(",", "."));

  if (!Number.isFinite(numero1) || !Number.isFinite(numero2)) {
    return null;
  }

  return {
    numero1,
    operador: coincidencia[2],
    numero2
  };
}

function calcularOperacion(operacion: Operacion): number {
  const { numero1, operador, numero2 } = operacion;

  let resultado: number;

  switch (operador) {
    case "+":
      resultado = numero1 + numero2;
      break;

    case "-":
      resultado = numero1 - numero2;
      break;

    case "*":
    case "×":
      resultado = numero1 * numero2;
      break;

    case "/":
    case "÷":
      if (numero2 === 0) {
        throw new Error("La división entre cero no está permitida.");
      }

      resultado = numero1 / numero2;
      break;

    default:
      throw new Error("Operación matemática no reconocida.");
  }

  if (!Number.isFinite(resultado)) {
    throw new Error("El resultado matemático no es válido.");
  }

  return Number(resultado.toFixed(10));
}

// ========================================
// NORMALIZACIÓN DE RESPUESTAS
// ========================================

function normalizarNumero(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, "").replace(",", ".");

  if (!/^-?\d+(?:\.\d+)?$/.test(limpio)) {
    return null;
  }

  const numero = Number(limpio);

  return Number.isFinite(numero) ? numero : null;
}

// ========================================
// GENERAR RETO
// ========================================

export async function generarRetoMatematicas(
  nivel: number = 1
): Promise<RetoGenerado> {

  const recientes = historialEjercicios.get(nivel) || [];
  let retoValido: RetoGenerado | null = null;
  let operacionValida: Operacion | null = null;

  for (
    let intento = 1;
    intento <= MAX_INTENTOS_GENERACION;
    intento++
  ) {
    const variacion = Math.random().toString(36).slice(2, 10);

    const reto = await consultarConRespaldo<RetoGenerado>(
      instruccionesMatematicas(nivel, recientes, variacion),
      ESQUEMA_RETO
    );

    if (
      !reto.prompt?.trim() ||
      !reto.hint?.trim() ||
      !reto.solution?.trim() ||
      !reto.category?.trim()
    ) {
      throw new Error("Gemini ha generado un ejercicio incompleto.");
    }

    const clave = normalizarEnunciado(reto.prompt);

    if (recientes.some(anterior =>
      normalizarEnunciado(anterior) === clave
    )) {
      console.warn(
        `[MATEMATICAS] Gemini repitió un ejercicio. Reintentando (${intento}/${MAX_INTENTOS_GENERACION}).`
      );
      continue;
    }

    const operacion = extraerOperacion(reto.prompt);

    if (!operacion) {
      throw new Error(
        "El ejercicio matemático no contiene una operación verificable."
      );
    }

    retoValido = reto;
    operacionValida = operacion;
    break;
  }

  if (!retoValido || !operacionValida) {
    throw new Error(
      "No se ha podido generar un ejercicio nuevo sin repetir los anteriores. Inténtalo de nuevo."
    );
  }

  const reto = retoValido;
  const operacion = operacionValida;
  const resultado = calcularOperacion(operacion);

  recientes.push(reto.prompt);
  while (recientes.length > MAX_HISTORIAL_EJERCICIOS) {
    recientes.shift();
  }
  historialEjercicios.set(nivel, recientes);

  // El servidor establece el resultado real.
  // No se utiliza el resultado numérico de Gemini.

  const explicacion = reto.solution
    .replace(/^RESULTADO\s*:\s*-?\d+(?:[.,]\d+)?\s*/i, "")
    .trim();

  reto.solution =
    `RESULTADO: ${resultado}\n${explicacion}`;

  return reto;
}

// ========================================
// EVALUAR RESPUESTA
// ========================================

export async function evaluarRespuestaMatematicas(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {

  const operacion = extraerOperacion(pregunta);

  if (!operacion) {
    throw new Error(
      "No se puede evaluar el ejercicio: falta una operación verificable."
    );
  }

  const resultadoCorrecto = calcularOperacion(operacion);
  const resultadoAlumno = normalizarNumero(respuesta);

  if (resultadoAlumno === null) {
    return {
      correct: false,
      feedback: "Escribe una respuesta numérica para poder corregirla.",
      explanation: "Introduce el resultado de la operación."
    };
  }

  const correcto =
    Math.abs(resultadoAlumno - resultadoCorrecto) < 0.0000001;

  if (correcto) {
    return {
      correct: true,
      feedback: "¡Muy bien! Has acertado.",
      explanation:
        `El resultado correcto es ${resultadoCorrecto}.`
    };
  }

  return {
    correct: false,
    feedback: "No es correcto todavía. ¡Inténtalo de nuevo!",
    explanation:
      "Revisa la operación y vuelve a intentarlo."
  };
}
