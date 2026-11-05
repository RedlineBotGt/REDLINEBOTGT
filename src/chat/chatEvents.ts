
// ======================================
// WEBLINE GT - EVENTOS DEL CHAT
// ======================================

import { EventEmitter } from "events";

import type { ChatMessage } from "./chatTypes.js";

// ======================================
// EMISOR DE EVENTOS
// ======================================

const chatEmitter = new EventEmitter();

chatEmitter.setMaxListeners(0);

// ======================================
// PUBLICAR MENSAJE
// ======================================

export function publishChatMessage(
  message: ChatMessage
): void {

  chatEmitter.emit("chatMessage", message);

}

// ======================================
// ESCUCHAR MENSAJES
// ======================================

export function onChatMessage(
  callback: (message: ChatMessage) => void
): () => void {

  chatEmitter.on("chatMessage", callback);

  // Devolver función para dejar de escuchar
  return () => {
    chatEmitter.off("chatMessage", callback);
  };

}

// ======================================
// CERRAR EVENTOS
// ======================================

export function clearChatEvents(): void {

  chatEmitter.removeAllListeners("chatMessage");

}
