// academia/challengesData.ts

export interface Challenge {
    id: string;
    level: number;
    category: string;
    prompt: string;
    explanation: string;
}

export const initialChallenges: Challenge[] = [
    // --- NIVEL 1: Matemáticas y Lógica Básica ---
    {
        id: "prim_101",
        level: 1,
        category: "Matemáticas 🔢",
        prompt: "En el parque hay 12 niños jugando al fútbol. Si llegan 7 amigos más para unirse al partido, ¿cuántos niños hay en total jugando ahora?",
        explanation: "19 niños. Se realiza una suma: 12 + 7 = 19."
    },
    {
        id: "prim_102",
        level: 1,
        category: "Lengua 📖",
        prompt: "Ordena mentalmente estas letras para formar una palabra relacionada con el cole: L - Á - P - I - Z. ¿Cómo se escribe correctamente?",
        explanation: "Lápiz."
    },

    // --- NIVEL 2: Problemas y Razonamiento ---
    {
        id: "prim_201",
        level: 2,
        category: "Problemas 🧩",
        prompt: "Mamá compra una caja con 24 rotuladores. Si al cabo de una semana se han perdido o gastado 6, ¿cuántos rotuladores buenos quedan en la caja?",
        explanation: "18 rotuladores. Se realiza una resta: 24 - 6 = 18."
    },
    {
        id: "prim_202",
        level: 2,
        category: "Naturaleza 🌿",
        prompt: "¿De qué color se ponen las hojas de la mayoría de los árboles caducos cuando llega el otoño antes de caer al suelo?",
        explanation: "Marrón, amarillo o rojizo."
    },

    // --- NIVEL 3: Retos avanzados para 2º de Primaria ---
    {
        id: "prim_301",
        level: 3,
        category: "Matemáticas Avanzadas 🔢",
        prompt: "Tienes 4 paquetes de cromos y en cada paquete vienen 5 cromos. ¿Cuántos cromos tienes en total?",
        explanation: "20 cromos. Se puede sumar 5 + 5 + 5 + 5 o multiplicar 4 x 5 = 20."
    }
];
