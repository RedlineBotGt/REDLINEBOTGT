// ========================================
// ESTUDIO MUSICAL · INSTRUMENTOS Y METRÓNOMO
// Audio generado localmente con Web Audio API.
// No utiliza servicios externos ni APIs de pago.
// ========================================

const NOTAS = [
  { nombre: "DO", frecuencia: 261.63, negra: false },
  { nombre: "DO♯", frecuencia: 277.18, negra: true },
  { nombre: "RE", frecuencia: 293.66, negra: false },
  { nombre: "RE♯", frecuencia: 311.13, negra: true },
  { nombre: "MI", frecuencia: 329.63, negra: false },
  { nombre: "FA", frecuencia: 349.23, negra: false },
  { nombre: "FA♯", frecuencia: 369.99, negra: true },
  { nombre: "SOL", frecuencia: 392.00, negra: false },
  { nombre: "SOL♯", frecuencia: 415.30, negra: true },
  { nombre: "LA", frecuencia: 440.00, negra: false },
  { nombre: "LA♯", frecuencia: 466.16, negra: true },
  { nombre: "SI", frecuencia: 493.88, negra: false }
];

let contextoAudio = null;
let instrumentoActual = "piano";
let metrónomoActivo = false;
let temporizadorMetrónomo = null;
let pulsoActual = 0;
let siguientePulso = 0;
let generacionMetrónomo = 0;

function audioContexto() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Este navegador no admite audio.");
  if (!contextoAudio) contextoAudio = new AudioContextClass();
  if (contextoAudio.state === "suspended") contextoAudio.resume();
  return contextoAudio;
}

function crearTeclado() {
  const teclado = document.getElementById("music-keyboard");
  if (!teclado) return;
  teclado.replaceChildren();

  for (let octava = 0; octava < 2; octava++) {
    const grupo = document.createElement("div");
    grupo.className = "music-octave";
    grupo.setAttribute("aria-label", `Octava ${octava + 4}`);

    NOTAS.filter(n => !n.negra).forEach((nota, indice) => {
      const boton = document.createElement("button");
      const frecuencia = nota.frecuencia * Math.pow(2, octava);
      boton.type = "button";
      boton.className = "music-key music-key-white";
      boton.dataset.frequency = String(frecuencia);
      boton.setAttribute("aria-label", `${nota.nombre} ${octava + 4}`);
      const etiqueta = document.createElement("span");
      etiqueta.textContent = nota.nombre;
      boton.appendChild(etiqueta);
      boton.addEventListener("pointerdown", evento => {
        evento.preventDefault();
        reproducirNota(frecuencia);
        boton.classList.add("pressed");
        window.setTimeout(() => boton.classList.remove("pressed"), 150);
      });
      boton.addEventListener("click", evento => {
        if (evento.detail === 0) reproducirNota(frecuencia);
      });
      grupo.appendChild(boton);
    });

    const negras = NOTAS.filter(n => n.negra);
    const posiciones = [0, 1, 3, 4, 5];
    negras.forEach((nota, indice) => {
      const boton = document.createElement("button");
      const frecuencia = nota.frecuencia * Math.pow(2, octava);
      boton.type = "button";
      boton.className = "music-key music-key-black";
      boton.style.left = `calc((100% / 7) * ${posiciones[indice] + 1})`;
      boton.dataset.frequency = String(frecuencia);
      boton.setAttribute("aria-label", `${nota.nombre} ${octava + 4}`);
      const etiqueta = document.createElement("span");
      etiqueta.textContent = nota.nombre;
      boton.appendChild(etiqueta);
      boton.addEventListener("pointerdown", evento => {
        evento.preventDefault();
        reproducirNota(frecuencia);
        boton.classList.add("pressed");
        window.setTimeout(() => boton.classList.remove("pressed"), 150);
      });
      boton.addEventListener("click", evento => {
        if (evento.detail === 0) reproducirNota(frecuencia);
      });
      grupo.appendChild(boton);
    });
    teclado.appendChild(grupo);
  }
}

function reproducirNota(frecuencia) {
  try {
    const ctx = audioContexto();
    const ahora = ctx.currentTime;
    const duracion = instrumentoActual === "guitarra" ? 1.1 : 0.75;
    const salida = ctx.createGain();
    salida.gain.setValueAtTime(0.0001, ahora);
    salida.gain.exponentialRampToValueAtTime(0.22, ahora + 0.025);
    salida.gain.exponentialRampToValueAtTime(0.0001, ahora + duracion);
    salida.connect(ctx.destination);

    const crearOsc = (tipo, freq, volumen, desafine = 0) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(freq, ahora);
      osc.detune.setValueAtTime(desafine, ahora);
      gain.gain.value = volumen;
      osc.connect(gain);
      gain.connect(salida);
      osc.start(ahora);
      osc.stop(ahora + duracion + 0.03);
    };

    if (instrumentoActual === "piano") {
      crearOsc("triangle", frecuencia, 0.78);
      crearOsc("sine", frecuencia * 2, 0.16);
      crearOsc("sine", frecuencia * 3, 0.045);
    } else if (instrumentoActual === "clarinete") {
      crearOsc("square", frecuencia, 0.28);
      crearOsc("triangle", frecuencia, 0.48, -4);
      crearOsc("sine", frecuencia * 3, 0.08);
    } else if (instrumentoActual === "trompeta") {
      crearOsc("sawtooth", frecuencia, 0.28);
      crearOsc("square", frecuencia * 2, 0.12);
      crearOsc("triangle", frecuencia, 0.32, 5);
    } else if (instrumentoActual === "guitarra") {
      crearOsc("triangle", frecuencia, 0.7);
      crearOsc("sine", frecuencia * 2, 0.2);
    }
  } catch (error) {
    console.error("[MÚSICA] No se pudo reproducir la nota:", error);
  }
}

function reproducirBateria(tipo) {
  try {
    const ctx = audioContexto();
    const ahora = ctx.currentTime;
    const salida = ctx.createGain();
    salida.connect(ctx.destination);

    if (tipo === "kick" || tipo === "tom") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const inicio = tipo === "kick" ? 130 : 190;
      const fin = tipo === "kick" ? 42 : 75;
      osc.frequency.setValueAtTime(inicio, ahora);
      osc.frequency.exponentialRampToValueAtTime(fin, ahora + 0.22);
      gain.gain.setValueAtTime(0.8, ahora);
      gain.gain.exponentialRampToValueAtTime(0.001, ahora + 0.28);
      osc.connect(gain); gain.connect(salida);
      osc.start(ahora); osc.stop(ahora + 0.3);
      return;
    }

    const longitud = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, longitud, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < longitud; i++) {
      datos[i] = (Math.random() * 2 - 1) * (1 - i / longitud);
    }
    const ruido = ctx.createBufferSource();
    const filtro = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    ruido.buffer = buffer;
    filtro.type = tipo === "hat" ? "highpass" : "bandpass";
    filtro.frequency.value = tipo === "hat" ? 7500 : 1800;
    gain.gain.setValueAtTime(tipo === "hat" ? 0.24 : 0.55, ahora);
    gain.gain.exponentialRampToValueAtTime(0.001, ahora + (tipo === "hat" ? 0.09 : 0.22));
    ruido.connect(filtro); filtro.connect(gain); gain.connect(salida);
    ruido.start(ahora);
  } catch (error) {
    console.error("[MÚSICA] No se pudo reproducir la batería:", error);
  }
}

function seleccionarInstrumento(nombre) {
  instrumentoActual = nombre;
  document.querySelectorAll("[data-instrument]").forEach(boton => {
    const activo = boton.dataset.instrument === nombre;
    boton.classList.toggle("active", activo);
    boton.setAttribute("aria-pressed", String(activo));
  });
  const bateria = nombre === "bateria";
  document.getElementById("music-keyboard-panel")?.classList.toggle("hidden", bateria);
  document.getElementById("music-drums-panel")?.classList.toggle("hidden", !bateria);
}

function compasActual() {
  const valor = document.getElementById("music-meter")?.value || "4/4";
  return valor === "6/8" ? 6 : Number(valor.split("/")[0]) || 4;
}

function actualizarIndicador(pulso) {
  const total = compasActual();
  document.querySelectorAll(".music-beat-dot").forEach((punto, indice) => {
    punto.classList.toggle("hidden", indice >= total);
    punto.classList.toggle("active", indice === pulso);
    punto.classList.toggle("accent", indice === 0 || (document.getElementById("music-meter")?.value === "6/8" && indice === 3));
  });
  const cuenta = document.getElementById("music-beat-count");
  if (cuenta) cuenta.textContent = `Compás ${document.getElementById("music-meter")?.value || "4/4"} · Pulso ${pulso + 1} de ${total}`;
}

function sonidoMetrónomo(acento) {
  try {
    const ctx = audioContexto();
    const ahora = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = acento ? 1250 : 850;
    gain.gain.setValueAtTime(acento ? 0.24 : 0.13, ahora);
    gain.gain.exponentialRampToValueAtTime(0.001, ahora + 0.065);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ahora); osc.stop(ahora + 0.07);
  } catch (error) {
    console.error("[MÚSICA] Error en metrónomo:", error);
  }
}

function detenerMetronomo() {
  metrónomoActivo = false;
  generacionMetrónomo++;
  if (temporizadorMetrónomo) window.clearTimeout(temporizadorMetrónomo);
  temporizadorMetrónomo = null;
  document.getElementById("music-metronome-status").textContent = "Detenido";
  document.getElementById("music-metronome-start").disabled = false;
  document.getElementById("music-metronome-stop").disabled = true;
  document.querySelectorAll(".music-beat-dot").forEach(p => p.classList.remove("active"));
}

function programarPulso(generacion) {
  if (!metrónomoActivo || generacion !== generacionMetrónomo) return;
  const bpm = Number(document.getElementById("music-tempo")?.value) || 100;
  const esSeisOcho = document.getElementById("music-meter")?.value === "6/8";
  const duracionPulso = (60000 / bpm) * (esSeisOcho ? 0.5 : 1);
  const total = compasActual();
  const acento = pulsoActual === 0 || (esSeisOcho && pulsoActual === 3);
  sonidoMetrónomo(acento);
  actualizarIndicador(pulsoActual);
  pulsoActual = (pulsoActual + 1) % total;
  temporizadorMetrónomo = window.setTimeout(() => programarPulso(generacion), duracionPulso);
}

function iniciarMetronomo() {
  if (metrónomoActivo) return;
  try {
    audioContexto();
    metrónomoActivo = true;
    pulsoActual = 0;
    const generacion = ++generacionMetrónomo;
    document.getElementById("music-metronome-status").textContent = "En marcha";
    document.getElementById("music-metronome-start").disabled = true;
    document.getElementById("music-metronome-stop").disabled = false;
    programarPulso(generacion);
  } catch (error) {
    document.getElementById("music-metronome-status").textContent = error.message;
  }
}

function mostrarPantalla(id) {
  document.querySelectorAll(".screen").forEach(p => p.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
}

export function iniciarMusicStudio() {
  crearTeclado();

  document.querySelectorAll("[data-instrument]").forEach(boton => {
    boton.addEventListener("click", () => seleccionarInstrumento(boton.dataset.instrument));
  });
  document.querySelectorAll("[data-drum]").forEach(boton => {
    boton.addEventListener("pointerdown", evento => {
      evento.preventDefault();
      reproducirBateria(boton.dataset.drum);
      boton.classList.add("pressed");
      window.setTimeout(() => boton.classList.remove("pressed"), 130);
    });
    boton.addEventListener("click", evento => {
      if (evento.detail === 0) reproducirBateria(boton.dataset.drum);
    });
  });

  document.getElementById("music-play-btn")?.addEventListener("click", () => {
    mostrarPantalla("music-play-screen");
    seleccionarInstrumento("piano");
  });
  document.getElementById("music-questions-btn")?.addEventListener("click", () => {
    mostrarPantalla("challenge-screen");
    document.dispatchEvent(new CustomEvent("academia:cargar-pregunta"));
  });
  document.getElementById("music-choice-back")?.addEventListener("click", () => mostrarPantalla("subjects-screen"));
  document.getElementById("music-play-back")?.addEventListener("click", () => {
    detenerMetronomo();
    mostrarPantalla("music-choice-screen");
  });

  const tempo = document.getElementById("music-tempo");
  tempo?.addEventListener("input", () => {
    document.getElementById("music-tempo-value").textContent = tempo.value;
  });
  document.getElementById("music-metronome-start")?.addEventListener("click", iniciarMetronomo);
  document.getElementById("music-metronome-stop")?.addEventListener("click", detenerMetronomo);
  document.getElementById("music-meter")?.addEventListener("change", () => {
    pulsoActual = 0;
    actualizarIndicador(0);
    if (metrónomoActivo) {
      detenerMetronomo();
      iniciarMetronomo();
    }
  });

  actualizarIndicador(0);
  console.log("[ACADEMIA] Estudio musical preparado.");
}
