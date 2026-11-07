import { obtenerPerfilActual } from "./users.js";
import { mostrarPantalla } from "./menu.js";

let chatActivo = false;
let temporizadorChat = null;
let cargandoMensajes = false;

const NOMBRES = {
  leo: "Leo",
  papa: "Papá",
  mama: "Mamá"
};

function mostrarAviso(texto, error = false) {
  const aviso = document.getElementById("chat-message");
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.classList.toggle("error", error);
}

function fechaMensaje(fecha) {
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "";
  return valor.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function pintarMensajes(mensajes) {
  const lista = document.getElementById("chat-messages");
  if (!lista) return;

  const estabaAbajo =
    lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;

  lista.replaceChildren();

  if (!mensajes.length) {
    const vacio = document.createElement("p");
    vacio.className = "chat-empty";
    vacio.textContent = "Todavía no hay mensajes. ¡Inicia la conversación!";
    lista.appendChild(vacio);
    return;
  }

  for (const mensaje of mensajes) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "chat-bubble";

    const cabecera = document.createElement("div");
    cabecera.className = "chat-bubble-header";

    const autor = document.createElement("strong");
    autor.textContent = NOMBRES[mensaje.perfil] || "Familia";

    const fecha = document.createElement("time");
    fecha.textContent = fechaMensaje(mensaje.creadoEn);
    if (mensaje.creadoEn) fecha.dateTime = mensaje.creadoEn;

    const texto = document.createElement("p");
    texto.className = "chat-bubble-text";
    texto.textContent = mensaje.texto;

    cabecera.append(autor, fecha);
    tarjeta.append(cabecera, texto);
    lista.appendChild(tarjeta);
  }

  if (estabaAbajo || lista.scrollTop === 0) {
    lista.scrollTop = lista.scrollHeight;
  }
}

async function cargarMensajes(silencioso = false) {
  if (cargandoMensajes) return;
  cargandoMensajes = true;

  try {
    const respuesta = await fetch("/api/academia/chat/messages", {
      headers: { Accept: "application/json" }
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(datos.error || "No se han podido cargar los mensajes.");
    }

    pintarMensajes(Array.isArray(datos.mensajes) ? datos.mensajes : []);
    if (!silencioso) mostrarAviso("");
  } catch (error) {
    console.error("[CHAT] Error al cargar:", error);
    if (!silencioso) {
      mostrarAviso(error.message || "No se ha podido conectar con el chat.", true);
    }
  } finally {
    cargandoMensajes = false;
  }
}

export async function abrirChat() {
  const perfil = obtenerPerfilActual();

  if (!perfil) {
    mostrarPantalla("profiles-screen");
    return;
  }

  chatActivo = true;
  mostrarPantalla("chat-screen");

  const nombre = document.getElementById("chat-profile-name");
  if (nombre) nombre.textContent = NOMBRES[perfil];

  const entrada = document.getElementById("chat-input");
  if (entrada) entrada.value = "";

  await cargarMensajes();

  if (temporizadorChat) clearInterval(temporizadorChat);
  temporizadorChat = setInterval(() => {
    if (chatActivo) cargarMensajes(true);
  }, 7000);

  entrada?.focus();
}

export function volverDesdeChat() {
  chatActivo = false;

  if (temporizadorChat) {
    clearInterval(temporizadorChat);
    temporizadorChat = null;
  }

  mostrarPantalla("subjects-screen");
}

async function enviarMensaje(evento) {
  evento.preventDefault();

  const perfil = obtenerPerfilActual();
  const entrada = document.getElementById("chat-input");
  const boton = document.getElementById("chat-send-btn");
  const texto = entrada?.value.trim() || "";

  if (!perfil || !texto) return;

  boton.disabled = true;
  mostrarAviso("Enviando mensaje...");

  try {
    const respuesta = await fetch("/api/academia/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfil, texto })
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(datos.error || "No se ha podido enviar el mensaje.");
    }

    entrada.value = "";
    mostrarAviso("");
    await cargarMensajes(true);
    entrada.focus();
  } catch (error) {
    mostrarAviso(error.message || "No se ha podido enviar el mensaje.", true);
  } finally {
    boton.disabled = false;
  }
}

export function iniciarChat() {
  const formulario = document.getElementById("chat-form");
  formulario?.addEventListener("submit", enviarMensaje);
}
