export interface RetoLengua {
    pregunta: string;
    opciones: { texto: string; esCorrecta: boolean }[];
    explicacion: string;
    nivel: number;
}

/**
 * Generador automático de retos de Lengua - Nivel 2º de Primaria
 */
export function generarRetoLengua(nivelActual: number): RetoLengua {
    let pregunta = '';
    let respuestaCorrecta = '';
    let opcionesFalsas: string[] = [];
    let explicacion = '';

    // Banco de preguntas adaptado para niños de 7 años (2º de Primaria)
    const bancoPrimaria = [
        {
            prep: '¿Cómo se escribe correctamente el plural de la palabra "lápiz"?',
            corr: 'Lápices',
            falsas: ['Lápizs', 'Lapises', 'Lápis'],
            exp: 'Las palabras que terminan en "z" cambian a "ces" en plural (lápiz -> lápices).'
        },
        {
            prep: '¿Cuál de estas palabras está escrita correctamente con "mb"?',
            corr: 'trompa',
            falsas: ['tronpa', 'trompa', 'trupa'],
            exp: 'Siempre se escribe "m" antes de la letra "p" y de la letra "b".'
        },
        {
            prep: '¿Qué palabra nombra una acción (un verbo)?',
            corr: 'Correr',
            falsas: ['Pelota', 'Rojo', 'Mesa'],
            exp: 'Correr es una acción que podemos hacer, por lo tanto es un verbo.'
        },
        {
            prep: '¿Cuál es el antónimo (lo contrario) de la palabra "alegre"?',
            corr: 'Triste',
            falsas: ['Contento', 'Feliz', 'Rápido'],
            exp: 'Lo contrario de estar alegre es estar triste.'
        },
        {
            prep: '¿Cómo se escribe correctamente?',
            corr: 'zanahoria',
            falsas: ['sanahoria', 'zahahoria', 'zanahora'],
            exp: 'Zanahoria se escribe con "z" al principio y "h" en medio.'
        },
        {
            prep: '¿Cuál de estas palabras es un sinónimo de "bonito"?',
            corr: 'Hermoso',
            falsas: ['Feo', 'Grande', 'Alto'],
            exp: 'Bonito y hermoso significan algo que tiene buena apariencia.'
        },
        {
            prep: '¿Qué palabra empieza por mayúscula porque es un nombre propio?',
            corr: 'Madrid',
            falsas: ['perro', 'zapato', 'colegio'],
            exp: 'Los nombres de ciudades, personas o ríos se escriben siempre con letra inicial mayúscula.'
        },
        {
            prep: '¿Cómo se escribe el sonido /g/ suave antes de "a", "o", "u"?',
            corr: 'gato',
            falsas: ['jato', 'guato', 'kato'],
            exp: 'La letra g con la a, o, u suena suave (ga, go, gu).'
        }
    ];

    const seleccionado = bancoPrimaria[Math.floor(Math.random() * bancoPrimaria.length)];
    pregunta = seleccionado.prep;
    respuestaCorrecta = seleccionado.corr;
    opcionesFalsas = seleccionado.falsas;
    explicacion = seleccionado.exp;

    // Montar las opciones barajadas
    const opcionesSet = new Set<string>([respuestaCorrecta]);
    opcionesFalsas.forEach(f => opcionesSet.add(f));

    const opcionesArray = Array.from(opcionesSet).sort(() => Math.random() - 0.5);
    const opcionesFinales = opcionesArray.map(val => ({
        texto: val,
        esCorrecta: val === respuestaCorrecta
    }));

    return {
        pregunta,
        opciones: opcionesFinales,
        explicacion,
        nivel: nivelActual
    };
}
