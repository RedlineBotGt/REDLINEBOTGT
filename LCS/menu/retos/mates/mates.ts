export interface RetoMatematico {
    pregunta: string;
    opciones: { texto: string; esCorrecta: boolean }[];
    explicacion: string;
    nivel: number;
}

/**
 * Generador automático de retos matemáticos adaptados por niveles de primaria
 */
export function generarRetoMates(nivelActual: number): RetoMatematico {
    let num1 = 0;
    let num2 = 0;
    let respuestaCorrecta = 0;
    let pregunta = '';
    let explicacion = '';

    if (nivelActual === 1) {
        num1 = Math.floor(Math.random() * 8) + 2; // entre 2 y 9
        num2 = Math.floor(Math.random() * 8) + 1; // entre 1 y 8
        const esSuma = Math.random() > 0.5;

        if (esSuma) {
            respuestaCorrecta = num1 + num2;
            pregunta = `¿Cuánto es ${num1} + ${num2}?`;
            explicacion = `Para sumar ${num1} y ${num2}, puedes contar ${num1} en tu cabeza y añadir ${num2} más hacia adelante. ¡El resultado es ${respuestaCorrecta}!`;
        } else {
            if (num1 < num2) [num1, num2] = [num2, num1];
            respuestaCorrecta = num1 - num2;
            pregunta = `¿Cuánto es ${num1} - ${num2}?`;
            explicacion = `Si tienes ${num1} y quitas ${num2}, te quedan ${respuestaCorrecta}.`;
        }
    } else if (nivelActual === 2) {
        num1 = Math.floor(Math.random() * 30) + 10;
        num2 = Math.floor(Math.random() * 20) + 5;
        const esSuma = Math.random() > 0.5;

        if (esSuma) {
            respuestaCorrecta = num1 + num2;
            pregunta = `¿Cuánto es ${num1} + ${num2}?`;
            explicacion = `Sumamos primero las unidades y luego las decenas. ¡El total es ${respuestaCorrecta}!`;
        } else {
            if (num1 < num2) [num1, num2] = [num2, num1];
            respuestaCorrecta = num1 - num2;
            pregunta = `¿Cuánto es ${num1} - ${num2}?`;
            explicacion = `Hacemos la resta quitando ${num2} a ${num1}, lo que nos da ${respuestaCorrecta}.`;
        }
    } else {
        num1 = Math.floor(Math.random() * 9) + 2;
        num2 = Math.floor(Math.random() * 9) + 2;
        respuestaCorrecta = num1 * num2;
        pregunta = `¿Cuánto es ${num1} × ${num2}?`;
        explicacion = `Multiplicar es sumar el mismo número varias veces: ${num1} sumado ${num2} veces da ${respuestaCorrecta}.`;
    }

    const opcionesSet = new Set<number>([respuestaCorrecta]);
    while (opcionesSet.size < 4) {
        const desvio = Math.floor(Math.random() * 5) - 2;
        const falsa = respuestaCorrecta + desvio;
        if (falsa >= 0 && falsa !== respuestaCorrecta) {
            opcionesSet.add(falsa);
        }
    }

    const opcionesArray = Array.from(opcionesSet).sort(() => Math.random() - 0.5);
    const opcionesFinales = opcionesArray.map(val => ({
        texto: val.toString(),
        esCorrecta: val === respuestaCorrecta
    }));

    return {
        pregunta,
        opciones: opcionesFinales,
        explicacion,
        nivel: nivelActual
    };
}
