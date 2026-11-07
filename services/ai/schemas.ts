// ========================================
// ESQUEMAS DE RESPUESTA DE GEMINI
// Academia Campos
// ========================================

// ========================================
// TIPOS
// ========================================

export interface RetoGenerado {
  prompt: string;
  hint: string;
  solution: string;
  category: string;
  visual?: { alt: string; items: Array<{ emoji: string; count: number }> };
}

export interface EvaluacionReto {
  correct: boolean;
  feedback: string;
  explanation: string;
}

// ========================================
// ESQUEMA DE GENERACIÓN DE RETOS
// ========================================

export const ESQUEMA_RETO = {
  type: "object",
  properties: {
    prompt: {
      type: "string"
    },
    hint: {
      type: "string"
    },
    solution: {
      type: "string"
    },
    category: {
      type: "string"
    },
    visual: {
      type: "object",
      properties: {
        alt: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              emoji: { type: "string" },
              count: { type: "integer" }
            },
            required: ["emoji", "count"]
          }
        }
      },
      required: ["alt", "items"]
    }
  },
  required: [
    "prompt",
    "hint",
    "solution",
    "category"
  ]
};

// ========================================
// ESQUEMA DE EVALUACIÓN
// ========================================

export const ESQUEMA_EVALUACION = {
  type: "object",
  properties: {
    correct: {
      type: "boolean"
    },
    feedback: {
      type: "string"
    },
    explanation: {
      type: "string"
    }
  },
  required: [
    "correct",
    "feedback",
    "explanation"
  ]
};