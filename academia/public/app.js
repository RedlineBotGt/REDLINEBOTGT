
// academia/public/app.js

let perfilActivo = null;
let currentChallengeId = null;
let currentChallengeHint = '';
let enviandoRespuesta = false;
let retoRespondido = false;

const nombres = {
    leo: 'Leo 🙇',
    papa: 'Papá 🧔🏻‍♂️',
    mama: 'Mamá 👩🏾‍🦱'
};

document.addEventListener('DOMContentLoaded', () => {
    const guardado = localStorage.getItem('perfil_activo');

    if (guardado && nombres[guardado]) {
        perfilActivo = guardado;
    }
});

// ==========================================
// UTILIDADES
// ==========================================

async function llamarAPI(ruta, datos) {
    const response = await fetch(ruta, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
    });

    let resultado;

    try {
        resultado = await response.json();
    } catch {
        throw new Error('El servidor ha devuelto una respuesta no válida.');
    }

    if (!response.ok || !resultado.success) {
        throw new Error(
            resultado.error || 'No se ha podido completar la operación.'
        );
    }

    return resultado;
}

function mostrarMensaje(elemento, mensaje) {
    if (elemento) {
        elemento.textContent = mensaje;
    }
}

// ==========================================
// SELECCIÓN DE PERFIL
// ==========================================

function seleccionarPerfil(perfil) {
    if (!nombres[perfil]) return;

    perfilActivo = perfil;

    localStorage.setItem('perfil_activo', perfil);

    document.getElementById('profiles-screen').style.display = 'none';
    document.getElementById('subjects-screen').style.display = 'block';

    const saludo = document.getElementById('subject-user-greeting');

    if (saludo) {
        saludo.textContent = `Hola, ${nombres[perfil]}`;
    }
}

function volverAPerfiles() {
    perfilActivo = null;

    localStorage.removeItem('perfil_activo');

    document.getElementById('subjects-screen').style.display = 'none';
    document.getElementById('profiles-screen').style.display = 'block';
}

// ==========================================
// SELECCIÓN DE ASIGNATURA
// ==========================================

async function seleccionarMateria(materia) {
    if (!perfilActivo) {
        alert('Selecciona primero un perfil.');
        return;
    }

    if (materia !== 'lateral') {
        alert('Esta asignatura estará disponible próximamente.');
        return;
    }

    document.getElementById('subjects-screen').style.display = 'none';
    document.getElementById('challenge-screen').style.display = 'block';

    const saludo = document.getElementById('user-greeting');

    if (saludo) {
        saludo.textContent = `Entrenando: ${nombres[perfilActivo]}`;
    }

    await cargarProgreso();
    await cargarSiguienteReto();
}

// ==========================================
// PROGRESO INDIVIDUAL
// ==========================================

async function cargarProgreso() {
    if (!perfilActivo) return;

    try {
        const data = await llamarAPI(
            '/api/academia/progress',
            { userId: perfilActivo }
        );

        const progreso = data.progress;

        const nivel = document.getElementById('current-level');

        if (nivel) {
            nivel.textContent = progreso.level;
        }

        let estadisticas = document.getElementById('academy-stats');

        if (!estadisticas) {
            estadisticas = document.createElement('div');
            estadisticas.id = 'academy-stats';
            estadisticas.style.margin = '12px 0';
            estadisticas.style.color = '#cbd5e1';

            const cabecera = document.querySelector('.challenge-header');

            if (cabecera) {
                cabecera.insertAdjacentElement('afterend', estadisticas);
            }
        }

        estadisticas.textContent =
            `⭐ ${progreso.score} puntos | ` +
            `✅ ${progreso.totalCorrect} aciertos | ` +
            `📝 ${progreso.totalAttempts} intentos`;

    } catch (error) {
        console.error('[Academia] Error cargando progreso:', error);
    }
}

// ==========================================
// CARGAR SIGUIENTE RETO
// ==========================================

async function cargarSiguienteReto() {
    if (!perfilActivo) return;

    const promptElement = document.getElementById('challenge-prompt');
    const answerInput = document.getElementById('user-answer');
    const feedbackBox = document.getElementById('ai-feedback');

    currentChallengeId = null;
    currentChallengeHint = '';
    retoRespondido = false;

    if (answerInput) {
        answerInput.value = '';
        answerInput.disabled = false;
    }

    const botonEnviar = document.querySelector('.send-btn');

    if (botonEnviar) {
        botonEnviar.disabled = false;
        botonEnviar.textContent = 'Enviar Respuesta';
    }

    if (feedbackBox) {
        feedbackBox.style.display = 'none';
        feedbackBox.textContent = '';
    }

    const botonPista = document.getElementById('hint-btn');

    if (botonPista) {
        botonPista.disabled = false;
        botonPista.style.display = 'none';
    }

    mostrarMensaje(
        promptElement,
        '🧠 Gemini está preparando un nuevo reto...'
    );

    try {
        const data = await llamarAPI(
            '/api/academia/challenge/next',
            { userId: perfilActivo }
        );

        currentChallengeId = data.challenge.id;
        currentChallengeHint = data.challenge.hint || '';

        mostrarMensaje(promptElement, data.challenge.prompt);

        const categoria = document.querySelector('.category-tag');

        if (categoria) {
            categoria.textContent =
                data.challenge.category || 'Pensamiento lateral 🧠';
        }

        const nivel = document.getElementById('current-level');

        if (nivel) {
            nivel.textContent = data.level;
        }

        if (botonPista && currentChallengeHint) {
            botonPista.style.display = 'block';
        }

    } catch (error) {
        currentChallengeId = null;

        mostrarMensaje(
            promptElement,
            `⚠️ ${error.message}`
        );

        console.error('[Academia] Error generando reto:', error);
    }
}

// ==========================================
// MOSTRAR PISTA
// ==========================================

function mostrarPista() {
    if (!currentChallengeHint || retoRespondido) return;

    const feedbackBox = document.getElementById('ai-feedback');

    if (!feedbackBox) return;

    feedbackBox.style.display = 'block';
    feedbackBox.textContent = `💡 Pista: ${currentChallengeHint}`;
}

// ==========================================
// ENVIAR Y EVALUAR RESPUESTA
// ==========================================

async function enviarRespuesta() {
    if (enviandoRespuesta || retoRespondido) return;

    const answerInput = document.getElementById('user-answer');
    const answer = answerInput ? answerInput.value.trim() : '';

    if (!answer) {
        alert('Escribe una respuesta o razonamiento antes de enviar.');
        return;
    }

    if (!currentChallengeId) {
        alert('No hay ningún reto activo. Intenta cargar uno nuevo.');
        return;
    }

    enviandoRespuesta = true;

    const botonEnviar = document.querySelector('.send-btn');
    const feedbackBox = document.getElementById('ai-feedback');

    if (botonEnviar) {
        botonEnviar.disabled = true;
        botonEnviar.textContent = 'Evaluando...';
    }

    if (feedbackBox) {
        feedbackBox.style.display = 'block';
        feedbackBox.textContent = '🔍 Gemini está analizando tu razonamiento...';
    }

    try {
        const data = await llamarAPI(
            '/api/academia/challenge/submit',
            {
                userId: perfilActivo,
                challengeId: currentChallengeId,
                userAnswer: answer
            }
        );

        retoRespondido = true;

        if (answerInput) {
            answerInput.disabled = true;
        }

        if (feedbackBox) {
            feedbackBox.style.display = 'block';

            feedbackBox.textContent =
                `${data.correct ? '🎉 ¡Respuesta correcta!' : '🧠 ¡Vamos a aprender!'}\n\n` +
                `${data.feedback}\n\n` +
                `${data.explanation ? '📖 ' + data.explanation : ''}`;
        }

        if (data.correct) {
            if (botonEnviar) {
                botonEnviar.textContent = '¡Correcto!';
            }
        } else {
            if (botonEnviar) {
                botonEnviar.textContent = 'Respuesta evaluada';
            }
        }

        await cargarProgreso();

        // El alumno decide cuándo continuar.
        mostrarBotonSiguiente();

    } catch (error) {
        if (feedbackBox) {
            feedbackBox.style.display = 'block';
            feedbackBox.textContent = `⚠️ ${error.message}`;
        }

        // Si falla la evaluación, permitimos volver a intentarlo.
        if (botonEnviar) {
            botonEnviar.disabled = false;
            botonEnviar.textContent = 'Reintentar evaluación';
        }

        console.error('[Academia] Error evaluando respuesta:', error);

    } finally {
        enviandoRespuesta = false;
    }
}

// ==========================================
// BOTÓN SIGUIENTE RETO
// ==========================================

function mostrarBotonSiguiente() {
    let boton = document.getElementById('next-challenge-btn');

    if (!boton) {
        boton = document.createElement('button');

        boton.id = 'next-challenge-btn';
        boton.className = 'send-btn';
        boton.style.marginTop = '12px';
        boton.textContent = 'Siguiente reto ➜';

        boton.addEventListener('click', async () => {
            boton.disabled = true;
            boton.textContent = 'Preparando...';

            await cargarSiguienteReto();

            boton.disabled = false;
            boton.textContent = 'Siguiente reto ➜';
        });

        const inputGroup = document.querySelector('.input-group');

        if (inputGroup) {
            inputGroup.appendChild(boton);
        }
    }

    boton.style.display = 'block';
}

// ==========================================
// VOLVER AL MENÚ
// ==========================================

function volverAlMenu() {
    document.getElementById('challenge-screen').style.display = 'none';
    document.getElementById('subjects-screen').style.display = 'block';

    const botonSiguiente = document.getElementById('next-challenge-btn');

    if (botonSiguiente) {
        botonSiguiente.style.display = 'none';
    }
}
