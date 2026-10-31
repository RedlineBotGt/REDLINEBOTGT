
/* =====================================================
   ACADEMIA CAMPOS
   academia/public/app.js
   ===================================================== */

const API_BASE = '/api/academia';

let perfilActivo = null;
let nombrePerfilActivo = '';
let asignaturaActiva = 'lateral';

let currentChallengeId = null;
let currentChallengeHint = '';
let respuestaEnviada = false;
let cargandoReto = false;

const perfiles = {
    leo: 'Leo',
    papa: 'Papá',
    mama: 'Mamá'
};

const asignaturas = {
    lateral: 'Pensamiento lateral',
    matematicas: 'Matemáticas',
    geografia: 'Geografía y ciencia'
};

/* =====================================================
   UTILIDADES
   ===================================================== */

function obtenerElemento(...ids) {
    for (const id of ids) {
        const elemento = document.getElementById(id);
        if (elemento) return elemento;
    }

    return null;
}

function mostrarPantalla(nombre) {
    const pantallas = [
        'profiles-screen',
        'subjects-screen',
        'challenge-screen',
        'ranking-screen'
    ];

    pantallas.forEach(id => {
        const pantalla = document.getElementById(id);

        if (pantalla) {
            pantalla.style.display = 'none';
        }
    });

    const destino = document.getElementById(nombre);

    if (destino) {
        destino.style.display = 'block';
    }
}

async function llamarAPI(ruta, datos = {}) {
    const respuesta = await fetch(`${API_BASE}/${ruta}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
    });

    let resultado;

    try {
        resultado = await respuesta.json();
    } catch {
        throw new Error('El servidor ha devuelto una respuesta inválida.');
    }

    if (!respuesta.ok || resultado.success === false) {
        throw new Error(
            resultado.message || 'Ha ocurrido un error.'
        );
    }

    return resultado;
}

function mostrarMensaje(mensaje, tipo = 'info') {
    const caja = obtenerElemento('ai-feedback', 'feedback-box');

    if (!caja) {
        alert(mensaje);
        return;
    }

    caja.textContent = mensaje;
    caja.className = `ai-feedback ${tipo}`;
    caja.style.display = 'block';
}

function ocultarMensaje() {
    const caja = obtenerElemento('ai-feedback', 'feedback-box');

    if (caja) {
        caja.textContent = '';
        caja.style.display = 'none';
    }
}

function establecerTexto(ids, texto) {
    const elemento = obtenerElemento(...ids);

    if (elemento) {
        elemento.textContent = texto;
    }
}

function establecerBotonDesactivado(ids, desactivado) {
    const boton = obtenerElemento(...ids);

    if (boton) {
        boton.disabled = desactivado;
    }
}

/* =====================================================
   PERFILES
   ===================================================== */

function seleccionarPerfil(perfil) {
    if (!Object.prototype.hasOwnProperty.call(perfiles, perfil)) {
        alert('Perfil no válido.');
        return;
    }

    perfilActivo = perfil;
    nombrePerfilActivo = perfiles[perfil];

    localStorage.setItem('academia_perfil', perfil);

    establecerTexto(
        ['user-greeting'],
        `¡Hola, ${nombrePerfilActivo}!`
    );

    mostrarPantalla('subjects-screen');

    cargarProgresoGeneral();
}

function volverAperfiles() {
    perfilActivo = null;
    nombrePerfilActivo = '';

    localStorage.removeItem('academia_perfil');

    mostrarPantalla('profiles-screen');
}

/* =====================================================
   ASIGNATURAS
   ===================================================== */

async function seleccionarMateria(asignatura) {
    if (!perfilActivo) {
        alert('Primero selecciona un perfil.');
        return;
    }

    if (!Object.prototype.hasOwnProperty.call(asignaturas, asignatura)) {
        alert('Asignatura no válida.');
        return;
    }

    if (asignatura !== 'lateral') {
        alert('Esta asignatura estará disponible próximamente.');
        return;
    }

    asignaturaActiva = asignatura;
    currentChallengeId = null;
    currentChallengeHint = '';
    respuestaEnviada = false;

    establecerTexto(
        ['user-greeting'],
        `¡Hola, ${nombrePerfilActivo}!`
    );

    mostrarPantalla('challenge-screen');

    await cargarProgreso();
    await cargarSiguienteReto();
}

/* =====================================================
   PROGRESO
   ===================================================== */

async function cargarProgreso() {
    if (!perfilActivo) return;

    try {
        const resultado = await llamarAPI('progress', {
            userId: perfilActivo,
            subject: asignaturaActiva
        });

        const progreso = resultado.progress;

        establecerTexto(
            ['current-level'],
            `Nivel ${progreso.level}`
        );

        const estadisticas = obtenerElemento('academy-stats');

        if (estadisticas) {
            estadisticas.textContent =
                `⭐ ${progreso.score} puntos · ` +
                `✓ ${progreso.totalCorrect} aciertos · ` +
                `${progreso.accuracy}% de aciertos`;
        }

    } catch (error) {
        console.error('Error cargando progreso:', error);
        mostrarMensaje(error.message, 'error');
    }
}

async function cargarProgresoGeneral() {
    if (!perfilActivo) return;

    try {
        const resultado = await llamarAPI('ranking');

        const jugador = resultado.ranking.find(
            item => item.userId === perfilActivo
        );

        if (!jugador) return;

        establecerTexto(
            ['general-score'],
            `${jugador.score} puntos`
        );

    } catch (error) {
        console.error('Error cargando resumen:', error);
    }
}

/* =====================================================
   RETOS
   ===================================================== */

async function cargarSiguienteReto() {
    if (!perfilActivo || cargandoReto) return;

    cargandoReto = true;
    respuestaEnviada = false;
    currentChallengeId = null;
    currentChallengeHint = '';

    ocultarMensaje();

    establecerBotonDesactivado(
        ['send-btn', 'submit-answer'],
        true
    );

    const botonSiguiente = document.getElementById(
        'next-challenge-btn'
    );

    if (botonSiguiente) {
        botonSiguiente.style.display = 'none';
    }

    establecerTexto(
        ['challenge-prompt'],
        'Preparando un nuevo reto...'
    );

    const respuesta = obtenerElemento('user-answer', 'answer-input');

    if (respuesta) {
        respuesta.value = '';
        respuesta.disabled = false;
    }

    try {
        const resultado = await llamarAPI('challenge/next', {
            userId: perfilActivo,
            subject: asignaturaActiva
        });

        const reto = resultado.challenge;

        if (!reto || !reto.id || !reto.prompt) {
            throw new Error('El servidor no ha devuelto un reto válido.');
        }

        currentChallengeId = reto.id;
        currentChallengeHint = reto.hint || '';

        establecerTexto(
            ['challenge-prompt'],
            reto.prompt
        );

        establecerTexto(
            ['category-tag'],
            reto.category || asignaturas[asignaturaActiva]
        );

        establecerTexto(
            ['current-level'],
            `Nivel ${resultado.level || 1}`
        );

        establecerBotonDesactivado(
            ['send-btn', 'submit-answer'],
            false
        );

    } catch (error) {
        console.error('Error cargando reto:', error);

        establecerTexto(
            ['challenge-prompt'],
            'No se ha podido cargar el reto.'
        );

        mostrarMensaje(
            `${error.message} Puedes volver a intentarlo.`,
            'error'
        );

        mostrarBotonReintentar();

    } finally {
        cargandoReto = false;
    }
}

/* =====================================================
   PISTAS
   ===================================================== */

function mostrarPista() {
    if (!currentChallengeId) {
        mostrarMensaje('Primero carga un reto.', 'error');
        return;
    }

    if (!currentChallengeHint) {
        mostrarMensaje(
            'Este reto no tiene una pista disponible.',
            'info'
        );
        return;
    }

    mostrarMensaje(
        `💡 Pista: ${currentChallengeHint}`,
        'hint'
    );
}

/* =====================================================
   ENVÍO Y EVALUACIÓN
   ===================================================== */

async function enviarRespuesta() {
    if (!perfilActivo || !currentChallengeId) {
        mostrarMensaje('No hay ningún reto activo.', 'error');
        return;
    }

    if (respuestaEnviada) {
        return;
    }

    const campoRespuesta = obtenerElemento(
        'user-answer',
        'answer-input'
    );

    if (!campoRespuesta) {
        mostrarMensaje('No se encuentra el campo de respuesta.', 'error');
        return;
    }

    const respuesta = campoRespuesta.value.trim();

    if (!respuesta) {
        mostrarMensaje('Escribe tu respuesta antes de enviarla.', 'error');
        return;
    }

    respuestaEnviada = true;

    establecerBotonDesactivado(
        ['send-btn', 'submit-answer'],
        true
    );

    campoRespuesta.disabled = true;

    mostrarMensaje('Gemini está evaluando tu respuesta...', 'info');

    try {
        const resultado = await llamarAPI('challenge/submit', {
            userId: perfilActivo,
            subject: asignaturaActiva,
            challengeId: currentChallengeId,
            userAnswer: respuesta
        });

        const mensaje = resultado.correct
            ? `¡Correcto! 🎉 ${resultado.feedback}`
            : `Todavía no. ${resultado.feedback}`;

        mostrarMensaje(
            `${mensaje}\n\n${resultado.explanation || ''}`,
            resultado.correct ? 'success' : 'error'
        );

        establecerTexto(
            ['current-level'],
            `Nivel ${resultado.level}`
        );

        const estadisticas = obtenerElemento('academy-stats');

        if (estadisticas) {
            estadisticas.textContent =
                `⭐ ${resultado.score} puntos · ` +
                `✓ ${resultado.totalCorrect} aciertos`;
        }

        campoRespuesta.disabled = true;

        mostrarBotonSiguiente();

        await cargarProgreso();

    } catch (error) {
        console.error('Error enviando respuesta:', error);

        respuestaEnviada = false;
        campoRespuesta.disabled = false;

        establecerBotonDesactivado(
            ['send-btn', 'submit-answer'],
            false
        );

        mostrarMensaje(
            `${error.message} Puedes volver a enviar tu respuesta.`,
            'error'
        );
    }
}

/* =====================================================
   BOTONES DE NAVEGACIÓN DE RETOS
   ===================================================== */

function mostrarBotonSiguiente() {
    let boton = document.getElementById('next-challenge-btn');

    if (!boton) {
        const grupo = document.querySelector('.input-group');

        if (!grupo) return;

        boton = document.createElement('button');
        boton.id = 'next-challenge-btn';
        boton.type = 'button';
        boton.className = 'send-btn';
        boton.textContent = 'Siguiente reto';

        boton.addEventListener('click', () => {
            cargarSiguienteReto();
        });

        grupo.appendChild(boton);
    }

    boton.style.display = 'block';
}

function mostrarBotonReintentar() {
    let boton = document.getElementById('retry-challenge-btn');

    if (!boton) {
        const grupo = document.querySelector('.input-group');

        if (!grupo) return;

        boton = document.createElement('button');
        boton.id = 'retry-challenge-btn';
        boton.type = 'button';
        boton.className = 'send-btn';
        boton.textContent = 'Reintentar carga';

        boton.addEventListener('click', () => {
            boton.style.display = 'none';
            cargarSiguienteReto();
        });

        grupo.appendChild(boton);
    }

    boton.style.display = 'block';
}

function volverAsignaturas() {
    currentChallengeId = null;
    currentChallengeHint = '';
    respuestaEnviada = false;

    mostrarPantalla('subjects-screen');

    cargarProgresoGeneral();
}

/* =====================================================
   RANKING
   ===================================================== */

async function mostrarRanking(asignatura = null) {
    if (!perfilActivo) {
        alert('Selecciona primero un perfil.');
        return;
    }

    let pantalla = document.getElementById('ranking-screen');

    if (!pantalla) {
        pantalla = document.createElement('section');
        pantalla.id = 'ranking-screen';
        pantalla.className = 'screen';

        const subjectsScreen = document.getElementById('subjects-screen');

        if (subjectsScreen && subjectsScreen.parentNode) {
            subjectsScreen.parentNode.appendChild(pantalla);
        } else {
            document.body.appendChild(pantalla);
        }
    }

    mostrarPantalla('ranking-screen');

    pantalla.innerHTML = `
        <div class="ranking-container">
            <h2>🏆 Ranking Academia Campos</h2>

            <div class="ranking-tabs">
                <button type="button" id="ranking-general">
                    General
                </button>
                <button type="button" data-subject="lateral">
                    Pensamiento lateral
                </button>
                <button type="button" data-subject="matematicas">
                    Matemáticas
                </button>
                <button type="button" data-subject="geografia">
                    Geografía y ciencia
                </button>
            </div>

            <div id="ranking-results">
                Cargando clasificación...
            </div>

            <button type="button" id="ranking-back">
                Volver
            </button>
        </div>
    `;

    pantalla.querySelector('#ranking-general').addEventListener(
        'click',
        () => mostrarRanking(null)
    );

    pantalla.querySelectorAll('[data-subject]').forEach(boton => {
        boton.addEventListener('click', () => {
            mostrarRanking(boton.dataset.subject);
        });
    });

    pantalla.querySelector('#ranking-back').addEventListener(
        'click',
        () => mostrarPantalla('subjects-screen')
    );

    const resultados = document.getElementById('ranking-results');

    try {
        const datos = asignatura
            ? { subject: asignatura }
            : {};

        const resultado = await llamarAPI('ranking', datos);

        if (!resultados) return;

        if (!resultado.ranking || resultado.ranking.length === 0) {
            resultados.textContent = 'Todavía no hay puntuaciones.';
            return;
        }

        resultados.innerHTML = '';

        resultado.ranking.forEach((jugador, indice) => {
            const fila = document.createElement('div');
            fila.className = 'ranking-row';

            const posicion = document.createElement('strong');
            posicion.textContent = `${indice + 1}.`;

            const nombre = document.createElement('span');
            nombre.textContent = jugador.name;

            const puntos = document.createElement('span');
            puntos.textContent = `${jugador.score} puntos`;

            const aciertos = document.createElement('small');
            aciertos.textContent =
                `${jugador.totalCorrect} aciertos · ${jugador.accuracy}%`;

            fila.append(posicion, nombre, puntos, aciertos);

            if (jugador.userId === perfilActivo) {
                fila.classList.add('ranking-current-user');
            }

            resultados.appendChild(fila);
        });

    } catch (error) {
        console.error('Error cargando ranking:', error);

        if (resultados) {
            resultados.textContent = error.message;
        }
    }
}

/* =====================================================
   INICIO
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const perfilGuardado = localStorage.getItem('academia_perfil');

    if (perfilGuardado && perfiles[perfilGuardado]) {
        seleccionarPerfil(perfilGuardado);
    } else {
        mostrarPantalla('profiles-screen');
    }

    const botonEnviar = obtenerElemento(
        'send-btn',
        'submit-answer'
    );

    if (botonEnviar) {
        botonEnviar.addEventListener('click', enviarRespuesta);
    }

    const botonPista = obtenerElemento('hint-btn');

    if (botonPista) {
        botonPista.addEventListener('click', mostrarPista);
    }
});

/* =====================================================
   FUNCIONES DISPONIBLES DESDE EL HTML
   ===================================================== */

window.seleccionarPerfil = seleccionarPerfil;
window.seleccionarMateria = seleccionarMateria;
window.mostrarPista = mostrarPista;
window.enviarRespuesta = enviarRespuesta;
window.cargarSiguienteReto = cargarSiguienteReto;
window.volverAsignaturas = volverAsignaturas;
window.volverAperfiles = volverAperfiles;
window.mostrarRanking = mostrarRanking;
