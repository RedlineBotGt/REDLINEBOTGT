//academia/public/app.js

let perfilActivo = null;

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si ya había un perfil seleccionado previamente
    const guardado = localStorage.getItem('perfil_activo');
    if (guardado) {
        // Opcional: podrías autoseleccionarlo o dejar que elija en la home
    }
});

async function seleccionarPerfil(perfil) {
    perfilActivo = perfil;
    localStorage.setItem('perfil_activo', perfil);

    // Ocultar pantalla de selección y mostrar pantalla de retos/asignaturas
    document.getElementById('profiles-screen').style.display = 'none';
    document.getElementById('challenge-screen').style.display = 'block';

    // Actualizar saludo personalizado
    const nombres = { leo: 'Leo 🙇', papa: 'Papá 🧔🏻‍♂️', mama: 'Mamá 👩🏾‍🦱' };
    document.getElementById('user-greeting').innerText = `Entrenando: ${nombres[perfil] || perfil}`;

    // Cargar el primer reto de pensamiento lateral
    await cargarSiguienteReto();
}

async function cargarSiguienteReto() {
    const promptElement = document.getElementById('challenge-prompt');
    const answerInput = document.getElementById('user-answer');
    const feedbackBox = document.getElementById('ai-feedback');

    promptElement.innerText = "🧠 La IA está generando un reto de pensamiento lateral a su medida...";
    answerInput.value = '';
    feedbackBox.style.display = 'none';

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
    const answer = document.getElementById('user-answer').value.trim();
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
            
            // Si acierta, cargar otro reto automáticamente a los 4 segundos
            setTimeout(() => {
                cargarSiguienteReto();
            }, 4500);
        } else {
            feedbackBox.innerHTML = "Hubo un error al evaluar la respuesta.";
        }
    } catch (error) {
        feedbackBox.innerHTML = "Error al conectar con la IA.";
    }
}

function volverAlMenu() {
    document.getElementById('challenge-screen').style.display = 'none';
    document.getElementById('profiles-screen').style.display = 'block';
    localStorage.removeItem('perfil_activo');
}
