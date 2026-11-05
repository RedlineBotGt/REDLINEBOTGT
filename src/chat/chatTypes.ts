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

  source: "webline" | "discord";

  replyTo?: {
    messageId: string;
    authorName: string;
    content: string;
  } | null;

  mentions?: {
    users: string[];
    roles: string[];
    channels?: string[];
  };

  // Nombres que se utilizarán al mostrar las menciones
  mentionData?: {
    users: Array<{
      id: string;
      name: string;
    }>;

    roles: Array<{
      id: string;
      name: string;
    }>;

    channels: Array<{
      id: string;
      name: string;
      url?: string;
    }>;
  };
}

// ======================================
// TIPOS DE MENCIONES
// ======================================

export interface ChatMention {
  id: string;
  name: string;
  avatar?: string | null;
  type: "user" | "role" | "channel";
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