
// ======================================
// WEBLINE GT - CHAT
// ======================================

const CHAT_API = "/api/chat";

// ======================================
// ELEMENTOS
// ======================================

let chatMessages;
let chatInput;
let chatSendButton;
let chatMentionsList;

let mentionResults = [];
let selectedMentionIndex = 0;
let currentMention = null;
let searchTimeout = null;

// ======================================
// INICIALIZAR CHAT
// ======================================

export function initializeChat() {

    chatMessages = document.getElementById("chat-messages");
    chatInput = document.getElementById("chat-input");
    chatSendButton = document.getElementById("chat-send");
    chatMentionsList = document.getElementById("chat-mentions-list");

    if (
        !chatMessages ||
        !chatInput ||
        !chatSendButton ||
        !chatMentionsList
    ) {
        console.warn("[CHAT] No se encontraron los elementos del chat.");
        return;
    }

    chatSendButton.addEventListener("click", sendMessage);

    chatInput.addEventListener("keydown", handleInputKeydown);

    chatInput.addEventListener("input", handleInputChange);

    loadMessages();

    console.log("[CHAT] Interfaz inicializada.");
}

// ======================================
// CARGAR HISTORIAL
// ======================================

async function loadMessages() {

    chatMessages.innerHTML = `
        <div class="chat-loading">
            Cargando mensajes...
        </div>
    `;

    try {

        const response = await fetch(`${CHAT_API}/messages`, {
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error("No se pudo cargar el chat.");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Error cargando mensajes.");
        }

        chatMessages.innerHTML = "";

        const messages = data.messages || [];

        if (messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="chat-empty">
                    Todavía no hay mensajes.
                </div>
            `;
            return;
        }

        messages.forEach(renderMessage);

        scrollToBottom();

    } catch (error) {

        console.error("[CHAT] Error:", error);

        chatMessages.innerHTML = `
            <div class="chat-error">
                No se pudo conectar con el chat.
            </div>
        `;
    }
}

// ======================================
// MOSTRAR MENSAJE
// ======================================

function renderMessage(message) {

    const messageElement = document.createElement("div");
    messageElement.className = "chat-message";
    messageElement.dataset.messageId = message.id;

    // AVATAR

    const avatar = document.createElement("img");

    avatar.className = "chat-avatar";
    avatar.src = message.authorAvatar || "/images/default-avatar.png";
    avatar.alt = "";
    avatar.loading = "lazy";

    avatar.onerror = () => {
        avatar.src = "https://cdn.discordapp.com/embed/avatars/0.png";
    };

    // CONTENIDO

    const content = document.createElement("div");
    content.className = "chat-message-content";

    // CABECERA

    const header = document.createElement("div");
    header.className = "chat-message-header";

    const author = document.createElement("span");
    author.className = "chat-author";
    author.textContent = message.authorName || "Usuario";

    header.appendChild(author);

    // DISTINTIVO WEBLINE

    if (message.source === "webline") {

        const badge = document.createElement("span");

        badge.className = "chat-webline-badge";
        badge.textContent = "WEBLINEGT";

        header.appendChild(badge);
    }

    // HORA

    const time = document.createElement("span");
    time.className = "chat-time";

    const date = new Date(message.createdAt);

    if (!Number.isNaN(date.getTime())) {
        time.textContent = date.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    header.appendChild(time);

    // TEXTO

    const text = document.createElement("div");
    text.className = "chat-message-text";

    renderMessageText(text, message.content || "");

    content.appendChild(header);
    content.appendChild(text);

    messageElement.appendChild(avatar);
    messageElement.appendChild(content);

    chatMessages.appendChild(messageElement);
}

// ======================================
// MOSTRAR TEXTO Y MENCIONES
// ======================================

function renderMessageText(element, message) {

    const regex = /<@!?(\d+)>|<@&(\d+)>/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(message)) !== null) {

        if (match.index > lastIndex) {
            element.appendChild(
                document.createTextNode(
                    message.slice(lastIndex, match.index)
                )
            );
        }

        const mention = document.createElement("span");

        mention.className = "chat-mention";

        mention.textContent = match[1]
            ? "@usuario"
            : "@rol";

        element.appendChild(mention);

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < message.length) {
        element.appendChild(
            document.createTextNode(message.slice(lastIndex))
        );
    }
}

// ======================================
// ENVIAR MENSAJE
// ======================================

async function sendMessage() {

    if (!chatInput) return;

    const content = chatInput.value.trim();

    if (!content) return;

    if (content.length > 2000) {
        alert("El mensaje supera los 2000 caracteres.");
        return;
    }

    chatSendButton.disabled = true;

    try {

        const response = await fetch(`${CHAT_API}/messages`, {
            method: "POST",

            credentials: "same-origin",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                content
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "No se pudo enviar el mensaje."
            );
        }

        chatInput.value = "";

        if (data.message) {
            renderMessage(data.message);
            scrollToBottom();
        }

    } catch (error) {

        console.error("[CHAT] Error enviando mensaje:", error);

        alert(error.message || "Error enviando el mensaje.");
    }

    chatSendButton.disabled = false;

    chatInput.focus();
}

// ======================================
// TECLADO
// ======================================

function handleInputKeydown(event) {

    if (mentionResults.length > 0) {

        if (event.key === "ArrowDown") {
            event.preventDefault();

            selectedMentionIndex =
                (selectedMentionIndex + 1) % mentionResults.length;

            renderMentionOptions();
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();

            selectedMentionIndex =
                (selectedMentionIndex - 1 + mentionResults.length) %
                mentionResults.length;

            renderMentionOptions();
            return;
        }

        if (event.key === "Enter" && currentMention) {
            event.preventDefault();

            selectMention(
                mentionResults[selectedMentionIndex]
            );

            return;
        }

        if (event.key === "Escape") {
            closeMentionList();
            return;
        }
    }

    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// ======================================
// DETECTAR ARROBA Y BÚSQUEDA
// ======================================

function handleInputChange() {

    const text = chatInput.value;
    const cursor = chatInput.selectionStart;

    const beforeCursor = text.slice(0, cursor);

    const match = beforeCursor.match(
        /(?:^|\s)@([^\s@]*)$/
    );

    if (!match) {
        closeMentionList();
        return;
    }

    const query = match[1];

    currentMention = {
        start: cursor - query.length - 1,
        end: cursor
    };

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
        searchMentions(query);
    }, 200);
}

// ======================================
// BUSCAR USUARIOS Y ROLES
// ======================================

async function searchMentions(query) {

    try {

        const response = await fetch(
            `${CHAT_API}/mentions?q=${encodeURIComponent(query)}`,
            {
                credentials: "same-origin"
            }
        );

        if (!response.ok) {
            throw new Error("Error buscando menciones.");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        mentionResults = data.results || [];

        selectedMentionIndex = 0;

        renderMentionOptions();

    } catch (error) {

        console.error("[CHAT] Error en menciones:", error);

        closeMentionList();
    }
}

// ======================================
// MOSTRAR SUGERENCIAS
// ======================================

function renderMentionOptions() {

    chatMentionsList.innerHTML = "";

    if (mentionResults.length === 0) {

        const empty = document.createElement("div");

        empty.className = "chat-mention-empty";
        empty.textContent = "No hay coincidencias.";

        chatMentionsList.appendChild(empty);

        chatMentionsList.hidden = false;

        return;
    }

    mentionResults.forEach((item, index) => {

        const option = document.createElement("button");

        option.type = "button";

        option.className = "chat-mention-option";

        if (index === selectedMentionIndex) {
            option.classList.add("active");
        }

        if (item.type === "user" && item.avatar) {

            const avatar = document.createElement("img");

            avatar.src = item.avatar;
            avatar.alt = "";
            avatar.onerror = () => avatar.remove();

            option.appendChild(avatar);

        } else {

            const icon = document.createElement("span");

            icon.textContent = "👥";

            option.appendChild(icon);
        }

        const name = document.createElement("span");

        name.className = "chat-mention-option-name";
        name.textContent = item.name;

        const type = document.createElement("span");

        type.className = "chat-mention-option-type";
        type.textContent = item.type === "role"
            ? "ROL"
            : "USUARIO";

        option.appendChild(name);
        option.appendChild(type);

        option.addEventListener("click", () => {
            selectMention(item);
        });

        chatMentionsList.appendChild(option);
    });

    chatMentionsList.hidden = false;
}

// ======================================
// SELECCIONAR MENCIÓN
// ======================================

function selectMention(item) {

    if (!currentMention || !chatInput) return;

    const text = chatInput.value;

    const before = text.slice(0, currentMention.start);

    const after = text.slice(currentMention.end);

    const mentionText = item.type === "role"
        ? `<@&${item.id}>`
        : `<@${item.id}>`;

    const insertion = `${mentionText} `;

    chatInput.value = before + insertion + after;

    const newCursor = before.length + insertion.length;

    chatInput.focus();

    chatInput.setSelectionRange(
        newCursor,
        newCursor
    );

    closeMentionList();
}

// ======================================
// CERRAR SUGERENCIAS
// ======================================

function closeMentionList() {

    mentionResults = [];

    currentMention = null;

    if (chatMentionsList) {
        chatMentionsList.innerHTML = "";
        chatMentionsList.hidden = true;
    }
}

// ======================================
// BAJAR AL ÚLTIMO MENSAJE
// ======================================

function scrollToBottom() {

    if (!chatMessages) return;

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}
