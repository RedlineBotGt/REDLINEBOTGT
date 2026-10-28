export interface RetoLengua {
    pregunta: string;
    opciones: { texto: string; esCorrecta: boolean }[];
    explicacion: string;
    nivel: number;
}

/**
 * Generador automático de retos de Lengua (Ortografía, Acentuación y Vocabulario)
 */
export function generarRetoLengua(nivelActual: number): RetoLengua {
    let pregunta = '';
    let respuestaCorrecta = '';
    let opcionesFalsas: string[] = [];
    let explicacion = '';

    // Banco de preguntas adaptado por bloques de dificultad
    if (nivelActual === 1) {
        const banco = [
            {
                prep: '¿Cómo se escribe correctamente?',
                corr: 'Excepción',
                falsas: ['Excepcion', 'Escepsión', 'Esepcion'],
                exp: 'Se escribe con "x" y con "pción" al final.'
            },
            {
                prep: '¿Cuál es el sinónimo correcto de la palabra "Efímero"?',
                corr: 'Pasajero',
                falsas: ['Eterno', 'Pesado', 'Luminoso'],
                exp: 'Efímero significa que dura poco tiempo, por lo tanto su sinónimo es pasajero.'
            },
            {
                prep: 'Indica qué palabra está acentuada correctamente:',
                corr: 'Lápiz',
                falsas: ['Lapíz', 'Lápis', 'Labiz'],
                exp: 'Lápiz es una palabra llana terminada en consonante distinta de n o s, por lo que lleva tilde.'
            },
            {
                prep: '¿Qué significa la locución latina "Carpe diem"?',
                corr: 'Aprovecha el momento',
                falsas: ['Por la fuerza', 'Sin fecha fija', 'En el tintero'],
                exp: '"Carpe diem" es una locución que anima a aprovechar el presente sin confiar en el futuro.'
            }
        ];
        const seleccionado = banco[Math.floor(Math.random() * banco.length)];
        pregunta = seleccionado.prep;
        respuestaCorrecta = seleccionado.corr;
        opcionesFalsas = seleccionado.falsas;
        explicacion = seleccionado.exp;

    } else {
        // Nivel avanzado / dinámico (Ortografía culta y trampas del idioma)
        const banco = [
            {
                prep: '¿Cuál es la forma correcta ante un caso de deísmo?',
                corr: 'Pienso que vendrá',
                falsas: ['Pienso de que vendrá', 'Pienso de que viene', 'Pienso que de que vendrá'],
                exp: 'El verbo pensar no rige la preposición "de". Lo correcto es "pienso que".'
            },
            {
                prep: '¿Cómo se escribe el plural de la palabra "carácter"?',
                corr: 'Caracteres',
                falsas: ['Carácteres', 'Caracters', 'Caracteris'],
                exp: 'Al pasar al plural, la palabra carácter desplaza su acento y pierde la tilde: caracteres.'
            },
            {
                prep: '¿Cuál es el significado de la palabra "Veleidoso"?',
                corr: 'Inconstante y mudable',
                falsas: ['Valiente y osado', 'Antiguo y viejo', 'Veloz y ligero'],
                exp: 'Una persona veleidosa cambia con facilidad de actitud o de opinión.'
            }
        ];
        const seleccionado = banco[Math.floor(Math.random() * banco.length)];
        pregunta = seleccionado.prep;
        respuestaCorrecta = seleccionado.corr;
        opcionesFalsas = seleccionado.falsas;
        explicacion = seleccionado.exp;
    }

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
