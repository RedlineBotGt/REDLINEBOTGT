
// ======================================
// WEBLINE GT - TIPOS DEL CHAT
// ======================================

// Identificador del canal de Discord
export const CHAT_CHANNEL_ID = "1525260593379151982";

// Número de mensajes que se cargarán al iniciar sesión
export const CHAT_HISTORY_LIMIT = 20;

// ======================================
// TIPOS DE MENSAJES
// ======================================

export interface ChatMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;

  // Indica si el mensaje procede de WEBLINE GT
  source: "webline" | "discord";

  // Datos de respuesta, si existe
  replyTo?: {
    messageId: string;
    authorName: string;
    content: string;
  } | null;

  // Usuarios y roles mencionados
  mentions?: {
    users: string[];
    roles: string[];
  };
}

// ======================================
// TIPOS DE MENCIONES
// ======================================

export interface ChatMention {
  id: string;
  name: string;
  avatar?: string | null;
  type: "user" | "role";
}

// ======================================
// RESPUESTA DE LA API
// ======================================

export interface ChatResponse {
  success: boolean;
  messages?: ChatMessage[];
  message?: string;
}

// ======================================
// DATOS PARA ENVIAR MENSAJES
// ======================================

export interface SendChatMessage {
  content: string;
  replyTo?: string | null;
}
