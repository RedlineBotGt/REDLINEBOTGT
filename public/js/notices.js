import { obtenerPerfilActual } from "./users.js";
import { solicitarAPI } from "./homework/api.js";

const nombres = { papa: "Papá", leo: "Leo", mama: "Mamá", todos: "Todos" };

function pintarAvisos(avisos) {
  const lista = document.getElementById("notices-list");
  if (!lista) return;
  lista.replaceChildren();
  if (!avisos.length) {
    const vacio = document.createElement("p");
    vacio.className = "notices-empty";
    vacio.textContent = "Todavía no hay avisos.";
    lista.appendChild(vacio);
    return;
  }
  for (const aviso of avisos) {
    const fila = document.createElement("p");
    fila.className = "notice-row";
    const autor = document.createElement("strong");
    autor.textContent = nombres[aviso.autor] || "Familia";
    const destino = document.createElement("span");
    destino.textContent = " → " + (nombres[aviso.destinatario] || "Familia") + ": ";
    const mensaje = document.createElement("span");
    mensaje.textContent = aviso.mensaje || "";
    const fecha = document.createElement("time");
    const d = new Date(aviso.creadoEn);
    fecha.textContent = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES", {day:"2-digit",month:"2-digit"});
    fila.append(autor, destino, mensaje, fecha);
    lista.appendChild(fila);
  }
}

async function cargarAvisos() {
  const lista = document.getElementById("notices-list");
  if (!lista) return;
  try {
    const datos = await solicitarAPI("/api/academia/notices");
    pintarAvisos(datos.avisos || []);
  } catch {
    lista.textContent = "No se han podido cargar los avisos.";
  }
}

function mostrarMensaje(texto, error = false) {
  const nodo = document.getElementById("notice-form-message");
  if (!nodo) return;
  nodo.textContent = texto;
  nodo.classList.toggle("error", error);
}

async function publicarAviso(event) {
  event.preventDefault();
  const destinatario = document.getElementById("notice-recipient")?.value;
  const campo = document.getElementById("notice-text");
  const boton = document.getElementById("notice-submit");
  const mensaje = campo?.value.trim() || "";
  if (!mensaje) return mostrarMensaje("Escribe el aviso.", true);
  if (boton) boton.disabled = true;
  try {
    await solicitarAPI("/api/academia/notices", {method:"POST", body:JSON.stringify({destinatario,mensaje})});
    campo.value = "";
    mostrarMensaje("Aviso publicado.");
    await cargarAvisos();
  } catch (error) {
    mostrarMensaje(error.message || "No se ha podido publicar.", true);
  } finally {
    if (boton) boton.disabled = false;
  }
}

export function iniciarAvisos() {
  document.addEventListener("academia:perfil-cambiado", event => {
    const botonPerfil = document.getElementById("open-notices-btn");
    const perfil = event.detail?.perfil;
    if (botonPerfil) botonPerfil.classList.toggle("hidden", perfil !== "papa");
  });
  const boton = document.getElementById("open-notices-btn");
  const panel = document.getElementById("notices-admin");
  const formulario = document.getElementById("notice-form");
  if (boton) boton.classList.toggle("hidden", obtenerPerfilActual() !== "papa");
  if (panel) panel.classList.add("hidden");
  if (boton && !boton.dataset.bound) {
    boton.dataset.bound = "true";
    boton.addEventListener("click", () => {
      panel?.classList.toggle("hidden");
      if (panel && !panel.classList.contains("hidden")) cargarAvisos();
    });
  }
  if (formulario && !formulario.dataset.bound) {
    formulario.dataset.bound = "true";
    formulario.addEventListener("submit", publicarAviso);
  }
  cargarAvisos();
}
