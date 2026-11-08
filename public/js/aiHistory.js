import { obtenerPerfilActual } from "./users.js";
import { solicitarAPI } from "./homework/api.js";

function mostrarPantallaHistorial() {
  document.querySelectorAll(".screen").forEach(pantalla => {
    pantalla.classList.add("hidden");
  });
  document.getElementById("ai-history-screen")?.classList.remove("hidden");
}

function crearElemento(tag, className, texto) {
  const elemento = document.createElement(tag);
  if (className) elemento.className = className;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

async function cargarHistorial() {
  const lista = document.getElementById("ai-history-list");
  const resumen = document.getElementById("ai-history-summary");
  if (!lista) return;

  lista.replaceChildren(crearElemento("p", "", "Cargando historial..."));
  if (resumen) resumen.textContent = "";

  try {
    const data = await solicitarAPI("/api/academia/ai-history");
    if (!Array.isArray(data.ejercicios)) {
      throw new Error("No se ha podido cargar el historial.");
    }

    lista.replaceChildren();
    if (resumen) {
      resumen.textContent = data.ejercicios.length === 1
        ? "1 ejercicio resuelto"
        : `${data.ejercicios.length} ejercicios resueltos`;
    }

    if (!data.ejercicios.length) {
      lista.appendChild(crearElemento("p", "", "Todavía no hay ejercicios resueltos con IA."));
      return;
    }

    for (const ejercicio of data.ejercicios) {
      const tarjeta = crearElemento("article", "ai-history-item");
      const cabecera = crearElemento("div", "ai-history-item-top");
      cabecera.appendChild(crearElemento("span", "ai-history-subject", ejercicio.asignatura || "Asignatura"));
      const intentos = Math.max(1, Number(ejercicio.intentos) || 1);
      cabecera.appendChild(crearElemento("span", "ai-history-attempts", `${intentos} ${intentos === 1 ? "intento" : "intentos"}`));
      tarjeta.append(cabecera, crearElemento("p", "ai-history-question", ejercicio.pregunta || ""));
      lista.appendChild(tarjeta);
    }
  } catch (error) {
    lista.replaceChildren(crearElemento("p", "", error.message || "Error al cargar el historial."));
  }
}

export function iniciarHistorialIA() {
  const boton = document.getElementById("open-ai-btn");
  const volver = document.getElementById("ai-history-back-btn");

  if (boton) {
    boton.addEventListener("click", () => {
      if (obtenerPerfilActual() !== "papa") return;
      mostrarPantallaHistorial();
      cargarHistorial();
    });
  }

  if (volver) {
    volver.addEventListener("click", () => {
      document.getElementById("ai-history-screen")?.classList.add("hidden");
      document.getElementById("subjects-screen")?.classList.remove("hidden");
    });
  }
}
