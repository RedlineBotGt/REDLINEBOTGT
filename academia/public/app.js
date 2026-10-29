// academia/public/app.js

let perfilActivo = null;

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si ya había un perfil seleccionado previamente en localStorage
    const guardado = localStorage.getItem('perfil_activo');
    if (guardado) {
        perfilActivo = guardado;
        // Si quieres que salte directo al menú de materias si ya hay sesión:
        // document.getElementById('profiles-screen').style.display = 'none';
        // document.getElementById('subjects-screen').style.display = 'block';
    }
});

// Paso 1: Al hacer clic en un perfil, guardamos el usuario y abrimos el Menú de Asignaturas
function seleccionarPerfil(perfil) {
    perfilActivo = perfil;
    localStorage.setItem('perfil_activo', perfil);

    // Ocultar pantalla de perfiles y mostrar pantalla de selección de materias
    document.getElementById('profiles-screen').style.display = 'none';
    document.getElementById('subjects-screen').style.display = 'block';

    const nombres = { leo: 'Leo 🙇', papa: 'Papá 🧔🏻‍♂️', mama: 'Mamá 👩🏾‍🦱' };
    const nombreLegible = nombres[perfil] || perfil;
    
    const saludoEl = document.getElementById('subject-user-greeting');
    if (saludoEl) {
        saludoEl.innerText = `Hola, ${nombreLegible}`;
    }
}

// Volver atrás desde el menú de materias a la selección de perfiles
function volverAPerfiles() {
    perfilActivo = null;
    localStorage.removeItem('perfil_activo');
    document.getElementById('subjects-screen').style.display = 'none';
    document.getElementById('profiles-screen').style.display = 'block';
}

// Paso 2: Seleccionar la asignatura (de momento, Pensamiento Lateral)
async function seleccionarMateria(materia) {
    if (materia !== 'lateral') return; // Preparado para futuras asignaturas

    // Ocultar selector de materias y mostrar pantalla de juego/retos
    document.getElementById('subjects-screen').style.display = 'none';
    document.getElementById('challenge-screen').style.display = 'block';

    const nombres = { leo: 'Leo 🙇', papa: 'Papá 🧔🏻‍♂️', mama: 'Mamá 👩🏾‍🦱' };
    document.getElementById('user-greeting').innerText = `Entrenando: ${nombres[perfil_activo] || perfilActivo}`;

    // Cargar el primer reto de pensamiento lateral
    await cargarSiguienteReto();
}

async function cargarSiguienteReto() {
    const promptElement = document.getElementById('challenge-prompt');
    const answerInput = document.getElementById('user-answer');
    const feedbackBox = document.getElementById('ai-feedback');

    promptElement.innerText = "🧠 La IA está generando un reto de pensamiento lateral a su medida...";
    if (answerInput) answerInput.value = '';
    if (feedbackBox) feedbackBox.style.display = 'none';

    try {
        const response = await fetch('/api/academia/challenge/next', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: perfilActivo })
        });
        const data = await response.json();

        if (data.success) {
            promptElement.innerText = data.challenge.prompt;
            document.getElementById('current-level').innerText = data.level || 1;
        } else {
            promptElement.innerText = "No se pudo cargar el reto. Inténtalo de nuevo.";
        }
    } catch (error) {
        promptElement.innerText = "Error de conexión con el servidor de la academia.";
    }
}

async function enviarRespuesta() {
    const answerInput = document.getElementById('user-answer');
    const answer = answerInput ? answerInput.value.trim() : '';
    if (!answer) {
        alert('Escribe una respuesta o razonamiento antes de enviar.');
        return;
    }

    const feedbackBox = document.getElementById('ai-feedback');
    feedbackBox.style.display = 'block';
    feedbackBox.innerHTML = "🔍 Analizando tu razonamiento lógico...";

    try {
        const response = await fetch('/api/academia/challenge/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: perfilActivo, userAnswer: answer })
        });
        const data = await response.json();

        if (data.success) {
            feedbackBox.innerHTML = `<strong>Respuesta de la IA:</strong><br>${data.feedback}`;

            // Si acierta, cargar otro reto automáticamente a los 4.5 segundos
            if (data.correct) {
                setTimeout(() => {
                    cargarSiguienteReto();
                }, 4500);
            }
        } else {
            feedbackBox.innerHTML = "Hubo un error al evaluar la respuesta.";
        }
    } catch (error) {
        feedbackBox.innerHTML = "Error al conectar con la IA.";
    }
}

// Volver desde la pantalla de retos al menú de materias
function volverAlMenu() {
    document.getElementById('challenge-screen').style.display = 'none';
    document.getElementById('subjects-screen').style.display = 'block';
}
