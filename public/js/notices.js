import { obtenerPerfilActual } from "./users.js";
import { solicitarAPI } from "./homework/api.js";

const nombres = { papa: "Papá", leo: "Leo", mama: "Mamá", todos: "Todos" };

const asignaturas = {
  ciencias: { icono: "🔬", nombre: "Ciencias" },
  matematicas: { icono: "🔢", nombre: "Matemáticas" },
  lengua: { icono: "📖", nombre: "Lengua" },
  geografia: { icono: "🗺️", nombre: "Geografía" },
  historia: { icono: "🏛️", nombre: "Historia" },
  ingles: { icono: "🇬🇧", nombre: "Inglés" },
  english: { icono: "🇬🇧", nombre: "English" },
  cultura: { icono: "🌍", nombre: "Cultura general" },
  cultura_general: { icono: "🌍", nombre: "Cultura general" },
  lenguaje_musical: { icono: "🎼", nombre: "Lenguaje Musical" },
  pensamiento_lateral: { icono: "🕵️", nombre: "Retos Imposibles" },
  otras: { icono: "📘", nombre: "Otras" }
};

function crearFecha(aviso) {
  const fecha = document.createElement("time");
  const d = new Date(aviso.creadoEn);
  fecha.textContent = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  return fecha;
}

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
    const esDeber = typeof aviso.mensaje === "string" &&
      aviso.mensaje.startsWith("__DEBER__:");

    if (esDeber) {
      fila.classList.add("notice-row-homework");
      const codigo = aviso.mensaje.slice("__DEBER__:".length);
      const asignatura = asignaturas[codigo] || {
        icono: "📚",
        nombre: codigo || "Asignatura"
      };

      const icono = document.createElement("span");
      icono.className = "notice-subject-icon";
      icono.textContent = asignatura.icono;
      icono.setAttribute("aria-hidden", "true");

      const nombreAsignatura = document.createElement("strong");
      nombreAsignatura.className = "notice-subject";
      nombreAsignatura.textContent = asignatura.nombre;

      const para = document.createElement("span");
      para.className = "notice-plain";
      para.textContent = "para";

      const destinatario = document.createElement("span");
      destinatario.className = "notice-recipient";
      destinatario.textContent = nombres[aviso.destinatario] || "Familia";

      fila.append(icono, nombreAsignatura, para, destinatario, crearFecha(aviso));
    } else {
      const autor = document.createElement("strong");
      autor.textContent = "🔔";
      autor.setAttribute("aria-label", "Aviso publicado por Papá");

      const destino = document.createElement("span");
      destino.className = "notice-recipient";
      destino.textContent = (nombres[aviso.destinatario] || "Familia") + ":";

      const mensaje = document.createElement("span");
      mensaje.className = "notice-message";
      mensaje.textContent = aviso.mensaje || "";

      fila.append(autor, destino, mensaje, crearFecha(aviso));
    }

    lista.appendChild(fila);
  }
}


function pintarGestionAvisos(avisos) {
  const lista = document.getElementById("notices-admin-list");
  if (!lista) return;
  lista.replaceChildren();

  if (!avisos.length) {
    const vacio = document.createElement("p");
    vacio.className = "notices-empty";
    vacio.textContent = "No hay avisos que gestionar.";
    lista.appendChild(vacio);
    return;
  }

  for (const aviso of avisos) {
    const item = document.createElement("article");
    item.className = "notice-admin-item";
    const esDeber = typeof aviso.mensaje === "string" && aviso.mensaje.startsWith("__DEBER__:");
    const resumen = document.createElement("p");
    resumen.className = "notice-admin-summary";
    resumen.textContent = (esDeber ? "📚 Aviso de deber · " : "🔔 Aviso manual · ") +
      (nombres[aviso.destinatario] || "Familia") + " · " +
      (esDeber ? (asignaturas[aviso.mensaje.slice(10)]?.nombre || aviso.mensaje.slice(10)) : aviso.mensaje);
    item.appendChild(resumen);

    const acciones = document.createElement("div");
    acciones.className = "notice-admin-actions";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "notice-edit-btn";
    editar.textContent = "✏️ Editar";
    editar.addEventListener("click", () => mostrarEditorAviso(item, aviso));
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "notice-delete-btn";
    borrar.textContent = "🗑️ Borrar";
    borrar.addEventListener("click", async () => {
      if (!confirm("¿Borrar este aviso? Esta acción no se puede deshacer.")) return;
      borrar.disabled = true;
      try {
        await solicitarAPI("/api/academia/notices/" + encodeURIComponent(aviso._id), { method: "DELETE" });
        await cargarAvisos();
      } catch (error) {
        alert(error.message || "No se ha podido borrar el aviso.");
        borrar.disabled = false;
      }
    });
    acciones.append(editar, borrar);
    item.appendChild(acciones);
    lista.appendChild(item);
  }
}

function mostrarEditorAviso(item, aviso) {
  if (item.querySelector("form")) return;
  const form = document.createElement("form");
  form.className = "notice-edit-form";
  const destinoLabel = document.createElement("label");
  destinoLabel.textContent = "Destinatario";
  const destino = document.createElement("select");
  for (const [valor, texto] of [["leo","Leo"],["mama","Mamá"],["todos","Todos"]]) {
    const opcion = document.createElement("option");
    opcion.value = valor;
    opcion.textContent = texto;
    destino.appendChild(opcion);
  }
  destino.value = aviso.destinatario;
  const mensajeLabel = document.createElement("label");
  mensajeLabel.textContent = "Mensaje";
  const mensaje = document.createElement("textarea");
  mensaje.rows = 2;
  mensaje.maxLength = 240;
  mensaje.required = true;
  mensaje.value = aviso.mensaje.startsWith("__DEBER__:") ?
    aviso.mensaje.slice("__DEBER__:".length) : aviso.mensaje;
  if (aviso.mensaje.startsWith("__DEBER__:")) {
    mensaje.value = "Aviso automático de deber: " + mensaje.value;
    mensaje.disabled = true;
    mensajeLabel.textContent = "Los avisos automáticos se actualizan desde el deber. Puedes cambiar el destinatario o borrarlos aquí.";
  }
  const guardar = document.createElement("button");
  guardar.type = "submit";
  guardar.textContent = "Guardar cambios";
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.textContent = "Cancelar";
  cancelar.addEventListener("click", () => form.remove());
  form.append(destinoLabel, destino, mensajeLabel, mensaje, guardar, cancelar);
  item.appendChild(form);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    guardar.disabled = true;
    try {
      const texto = aviso.mensaje.startsWith("__DEBER__:") ? aviso.mensaje : mensaje.value.trim();
      await solicitarAPI("/api/academia/notices/" + encodeURIComponent(aviso._id), {
        method: "PATCH",
        body: JSON.stringify({ destinatario: destino.value, mensaje: texto })
      });
      await cargarAvisos();
    } catch (error) {
      alert(error.message || "No se han podido guardar los cambios.");
      guardar.disabled = false;
    }
  });
}

async function cargarAvisos() {
  const lista = document.getElementById("notices-list");
  if (!lista) return;
  try {
    const datos = await solicitarAPI("/api/academia/notices");
    pintarAvisos(datos.avisos || []);
    pintarGestionAvisos(datos.avisos || []);
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
    await solicitarAPI("/api/academia/notices", {
      method: "POST",
      body: JSON.stringify({ destinatario, mensaje })
    });
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
