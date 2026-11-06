// ========================================
// ESQUEMAS DE RESPUESTA DE IA
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
}

export interface EvaluacionReto {
  correct: boolean;
  feedback: string;
  explanation: string;
}

// ========================================
// ESQUEMA PARA GENERAR RETOS
// ========================================

export const ESQUEMA_RETO = {
  type: "OBJECT",
  properties: {
    prompt: {
      type: "STRING"
    },
    hint: {
      type: "STRING"
    },
    solution: {
      type: "STRING"
    },
    category: {
      type: "STRING"
    }
  },
  required: [
    "prompt",
    "hint",
    "solution",
    "category"
  ],
  propertyOrdering: [
    "prompt",
    "hint",
    "solution",
    "category"
  ]
};

// ========================================
// ESQUEMA PARA EVALUAR RESPUESTAS
// ========================================

export const ESQUEMA_EVALUACION = {
  type: "OBJECT",
  properties: {
    correct: {
      type: "BOOLEAN"
    },
    feedback: {
      type: "STRING"
    },
    explanation: {
      type: "STRING"
    }
  },
  required: [
    "correct",
    "feedback",
    "explanation"
  ],
  propertyOrdering: [
    "correct",
    "feedback",
    "explanation"
  ]
};