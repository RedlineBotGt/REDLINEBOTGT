let perfilActivo = null;
let currentChallengeId = null; // 👈 Variable para almacenar el ID del reto actual

document.addEventListener('DOMContentLoaded', () => {
    const guardado = localStorage.getItem('perfil_activo');
    if (guardado) {
        perfilActivo = guardado;
    }
});

// Paso 1: Al hacer clic en un perfil, guardamos el usuario y abrimos el Menú de Asignaturas
function seleccionarPerfil(perfil) {
    perfilActivo = perfil;
    localStorage.setItem('perfil_activo', perfil);

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

// Paso 2: Seleccionar la asignatura
async function seleccionarMateria(materia) {
    if (materia !== 'lateral') return;

    document.getElementById('subjects-screen').style.display = 'none';
    document.getElementById('challenge-screen').style.display = 'block';

    const nombres = { leo: 'Leo 🙇', papa: 'Papá 🧔🏻‍♂️', mama: 'Mamá 👩🏾‍🦱' };
    document.getElementById('user-greeting').innerText = `Entrenando: ${nombres[perfil_activo] || perfilActivo}`;

    await cargarSiguienteReto();
}

async function cargarSiguienteReto() {
    const promptElement = document.getElementById('challenge-prompt');
    const answerInput = document.getElementById('user-answer');
    const feedbackBox = document.getElementById('ai-feedback');

    promptElement.innerText = "🧠 La IA está generando un reto a su medida...";
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
            currentChallengeId = data.challenge.id; // 👈 Guardamos el ID del reto recibido
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

    if (!currentChallengeId) {
        alert('Error: No hay ningún reto activo cargado.');
        return;
    }

    const feedbackBox = document.getElementById('ai-feedback');
    feedbackBox.style.display = 'block';
    feedbackBox.innerHTML = "🔍 Analizando tu razonamiento...";

    try {
        const response = await fetch('/api/academia/challenge/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: perfilActivo, 
                challengeId: currentChallengeId, // 👈 Enviamos el ID obligatorio que pedía el router
                userAnswer: answer 
            })
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
