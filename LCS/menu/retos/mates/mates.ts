export interface RetoMatematico {
    pregunta: string;
    opciones: { texto: string; esCorrecta: boolean }[];
    explicacion: string;
    nivel: number;
}

/**
 * Generador automático de retos matemáticos con progresión real de dificultad
 */
export function generarRetoMates(nivelActual: number): RetoMatematico {
    let num1 = 0;
    let num2 = 0;
    let respuestaCorrecta = 0;
    let pregunta = '';
    let explicacion = '';

    if (nivelActual === 1) {
        // Nivel 1: Sumas y restas básicas (números pequeños del 1 al 10)
        num1 = Math.floor(Math.random() * 8) + 2;
        num2 = Math.floor(Math.random() * 8) + 1;
        const esSuma = Math.random() > 0.5;

        if (esSuma) {
            respuestaCorrecta = num1 + num2;
            pregunta = `¿Cuánto es ${num1} + ${num2}?`;
            explicacion = `Suma ambos números: ${num1} + ${num2} = ${respuestaCorrecta}.`;
        } else {
            if (num1 < num2) [num1, num2] = [num2, num1];
            respuestaCorrecta = num1 - num2;
            pregunta = `¿Cuánto es ${num1} - ${num2}?`;
            explicacion = `Resta ${num2} a ${num1} para obtener ${respuestaCorrecta}.`;
        }
    } else if (nivelActual === 2) {
        // Nivel 2: Sumas y restas medianas (números hasta el 50)
        num1 = Math.floor(Math.random() * 30) + 10;
        num2 = Math.floor(Math.random() * 20) + 5;
        const esSuma = Math.random() > 0.5;

        if (esSuma) {
            respuestaCorrecta = num1 + num2;
            pregunta = `¿Cuánto es ${num1} + ${num2}?`;
            explicacion = `Sumando ${num1} y ${num2} obtenemos ${respuestaCorrecta}.`;
        } else {
            if (num1 < num2) [num1, num2] = [num2, num1];
            respuestaCorrecta = num1 - num2;
            pregunta = `¿Cuánto es ${num1} - ${num2}?`;
            explicacion = `El resultado de restar ${num2} a ${num1} es ${respuestaCorrecta}.`;
        }
    } else if (nivelActual === 3) {
        // Nivel 3: Sumas y restas amplias (números hasta el 100)
        num1 = Math.floor(Math.random() * 50) + 50;
        num2 = Math.floor(Math.random() * 40) + 10;
        const esSuma = Math.random() > 0.5;

        if (esSuma) {
            respuestaCorrecta = num1 + num2;
            pregunta = `¿Cuánto es ${num1} + ${num2}?`;
            explicacion = `Al sumar cifras más grandes, ${num1} + ${num2} da ${respuestaCorrecta}.`;
        } else {
            if (num1 < num2) [num1, num2] = [num2, num1];
            respuestaCorrecta = num1 - num2;
            pregunta = `¿Cuánto es ${num1} - ${num2}?`;
            explicacion = `Restando ${num2} de ${num1} nos da ${respuestaCorrecta}.`;
        }
    } else if (nivelActual === 4) {
        // Nivel 4: Tablas de multiplicar clásicas (del 2 al 9)
        num1 = Math.floor(Math.random() * 8) + 2;
        num2 = Math.floor(Math.random() * 8) + 2;
        respuestaCorrecta = num1 * num2;
        pregunta = `¿Cuánto es ${num1} × ${num2}?`;
        explicacion = `Multiplicar ${num1} por ${num2} equivale a sumar ${num1} tantas veces como indica ${num2}, resultando en ${respuestaCorrecta}.`;
    } else if (nivelActual === 5) {
        // Nivel 5: Multiplicaciones con factores mayores (hasta 12)
        num1 = Math.floor(Math.random() * 6) + 7; // entre 7 y 12
        num2 = Math.floor(Math.random() * 8) + 3; // entre 3 y 10
        respuestaCorrecta = num1 * num2;
        pregunta = `¿Cuánto es ${num1} × ${num2}?`;
        explicacion = `Calculamos el producto de ${num1} por ${num2}, obteniendo ${respuestaCorrecta}.`;
    } else {
        // Nivel 6 en adelante: Progresión dinámica avanzada que escala con el nivel
        const tipoOp = nivelActual % 3;
        
        if (tipoOp === 0) {
            // Multiplicaciones más avanzadas que crecen según el nivel
            const factorMax = Math.min(25, 10 + Math.floor(nivelActual / 2));
            num1 = Math.floor(Math.random() * factorMax) + 4;
            num2 = Math.floor(Math.random() * 10) + 5;
            respuestaCorrecta = num1 * num2;
            pregunta = `¿Cuánto es ${num1} × ${num2}?`;
            explicacion = `Multiplicación avanzada de nivel ${nivelActual}: ${num1} × ${num2} = ${respuestaCorrecta}.`;
        } else if (tipoOp === 1) {
            // Operaciones combinadas de tres sumandos
            num1 = Math.floor(Math.random() * 30) + 10;
            num2 = Math.floor(Math.random() * 30) + 10;
            const num3 = Math.floor(Math.random() * 20) + 5;
            respuestaCorrecta = num1 + num2 + num3;
            pregunta = `¿Cuánto es ${num1} + ${num2} + ${num3}?`;
            explicacion = `Suma combinada de tres números: sumando ${num1} + ${num2} + ${num3} da ${respuestaCorrecta}.`;
        } else {
            // Restas de gran formato
            num1 = Math.floor(Math.random() * 80) + 50;
            num2 = Math.floor(Math.random() * 40) + 10;
            if (num1 < num2) [num1, num2] = [num2, num1];
            respuestaCorrecta = num1 - num2;
            pregunta = `¿Cuánto es ${num1} - ${num2}?`;
            explicacion = `Resta de nivel avanzado: ${num1} - ${num2} = ${respuestaCorrecta}.`;
        }
    }

    // Generar opciones falsas lógicas y cercanas a la respuesta correcta
    const opcionesSet = new Set<number>([respuestaCorrecta]);
    while (opcionesSet.size < 4) {
        const desvio = Math.floor(Math.random() * (nivelActual * 2 + 4)) - (nivelActual + 2);
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
