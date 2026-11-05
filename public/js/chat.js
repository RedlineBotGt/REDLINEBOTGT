// ======================================
// WEBLINE GT - CHAT
// ======================================

const CHAT_API = "/api/chat";

let chatMessages;
let chatInput;
let chatSendButton;
let chatForm;
let chatMentionsList;
let sendingMessage = false;
let lastPointerSendAt = 0;

let mentionResults = [];
let selectedMentionIndex = 0;
let currentMention = null;
let searchTimeout = null;
let mentionSearchId = 0;
let chatStream = null;

const renderedMessageIds = new Set();

// ======================================
// INICIALIZAR
// ======================================

export function initializeChat() {

    chatMessages = document.getElementById("chat-messages");
    chatInput = document.getElementById("chat-input");
    chatSendButton = document.getElementById("chat-send");
    chatForm = document.getElementById("chat-form");
    chatMentionsList = document.getElementById("chat-mentions-list");

    if (
        !chatMessages ||
        !chatInput ||
        !chatSendButton ||
        !chatForm ||
        !chatMentionsList
    ) {
        console.warn("[CHAT] No se encontraron los elementos.");
        return;
    }

    chatMentionsList.hidden = true;

    // Envío directo para pantallas táctiles.
    chatSendButton.addEventListener("pointerdown", (event) => {

        if (
            event.pointerType === "touch" ||
            event.pointerType === "pen"
        ) {
            event.preventDefault();

            lastPointerSendAt = Date.now();

            sendMessage();
        }

    });

    // Respaldo para ratón y otros dispositivos.
    chatSendButton.addEventListener("click", (event) => {

        event.preventDefault();

        // Evitar que el mismo toque envíe dos veces.
        if (Date.now() - lastPointerSendAt < 800) {
            return;
        }

        sendMessage();

    });

    // Mantener también el envío del formulario.
    chatForm.addEventListener("submit", (event) => {

        event.preventDefault();
        sendMessage();

    });

    chatInput.addEventListener("keydown", handleInputKeydown);
    chatInput.addEventListener("input", handleInputChange);

    loadMessages();
    connectChatStream();

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
// CONEXIÓN EN DIRECTO
// ======================================

function connectChatStream() {

    if (chatStream) {
        chatStream.close();
    }

    chatStream = new EventSource(
        `${CHAT_API}/stream`,
        { withCredentials: true }
    );

    chatStream.addEventListener("connected", () => {
        console.log("[CHAT] Conexión en directo establecida.");
    });

    chatStream.addEventListener("chatMessage", (event) => {

        try {

            const message = JSON.parse(event.data);

            renderMessage(message);
            scrollToBottom();

        } catch (error) {

            console.error(
                "[CHAT] Error leyendo mensaje en directo:",
                error
            );

        }

    });

    chatStream.onerror = () => {
        console.warn(
            "[CHAT] Conexión interrumpida. Reconectando..."
        );
    };
}

// ======================================
// MOSTRAR MENSAJE
// ======================================

function renderMessage(message) {

    if (!message || !message.id) return;

    if (renderedMessageIds.has(message.id)) {
        return;
    }

    renderedMessageIds.add(message.id);

    const empty = chatMessages.querySelector(".chat-empty");

    if (empty) {
        empty.remove();
    }

    const loading = chatMessages.querySelector(".chat-loading");

    if (loading) {
        loading.remove();
    }

    const messageElement = document.createElement("div");

    messageElement.className = "chat-message";
    messageElement.dataset.messageId = message.id;

    // AVATAR

    const avatar = document.createElement("img");

    avatar.className = "chat-avatar";
    avatar.src =
        message.authorAvatar ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

    avatar.alt = "";
    avatar.loading = "lazy";

    avatar.onerror = () => {
        avatar.src =
            "https://cdn.discordapp.com/embed/avatars/0.png";
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
// TEXTO Y MENCIONES
// ======================================

function renderMessageText(element, message) {

    const regex = /<@!?(\\d+)>|<@&(\\d+)>/g;

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
        mention.textContent = match[1] ? "@usuario" : "@rol";

        element.appendChild(mention);

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < message.length) {

        element.appendChild(
            document.createTextNode(
                message.slice(lastIndex)
            )
        );

    }
}
// ======================================
// ENVIAR MENSAJE
// ======================================

async function sendMessage() {

    if (sendingMessage) return;

    const content = chatInput.value.trim();

    if (!content) return;

    sendingMessage = true;
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
        hideMentions();

        if (data.message) {
            renderMessage(data.message);
        }

        scrollToBottom();

    } catch (error) {

        console.error("[CHAT] Error enviando mensaje:", error);

        alert(
            error.message || "No se pudo enviar el mensaje."
        );

    } finally {

        sendingMessage = false;
        chatSendButton.disabled = false;
        chatInput.focus();

    }
}

// ======================================
// TECLADO
// ======================================

function handleInputKeydown(event) {

    if (chatMentionsList && !chatMentionsList.hidden) {

        if (event.key === "ArrowDown") {

            event.preventDefault();
            moveMentionSelection(1);
            return;

        }

        if (event.key === "ArrowUp") {

            event.preventDefault();
            moveMentionSelection(-1);
            return;

        }

        if (event.key === "Enter" && !event.shiftKey) {

            event.preventDefault();

            if (mentionResults.length > 0) {
                selectMention(selectedMentionIndex);
            }

            return;

        }

        if (event.key === "Escape") {

            hideMentions();
            return;

        }
    }

    if (event.key === "Enter" && !event.shiftKey) {

        event.preventDefault();
        sendMessage();

    }
}

// ======================================
// DETECTAR MENCIONES
// ======================================

function handleInputChange() {

    const value = chatInput.value;
    const cursor = chatInput.selectionStart;

    const textBeforeCursor = value.slice(0, cursor);

    const match = textBeforeCursor.match(
        /(^|\s)@([^\s@]*)$/
    );

    if (!match) {

        hideMentions();
        return;

    }

    const query = match[2] || "";

    currentMention = {
        start: cursor - query.length - 1,
        end: cursor
    };

    searchMentions(query);
}

// ======================================
// BUSCAR USUARIOS Y ROLES
// ======================================

async function searchMentions(query) {

    const requestId = ++mentionSearchId;

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {

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

            if (requestId !== mentionSearchId) {
                return;
            }

            mentionResults = data.results || [];

            selectedMentionIndex = 0;

            renderMentions();

        } catch (error) {

            console.error(
                "[CHAT] Error buscando menciones:",
                error
            );

            hideMentions();

        }

    }, 250);
}

// ======================================
// MOSTRAR RESULTADOS DE MENCIONES
// ======================================

function renderMentions() {

    chatMentionsList.innerHTML = "";

    if (mentionResults.length === 0) {

        hideMentions();
        return;

    }

    mentionResults.forEach((item, index) => {

        const option = document.createElement("button");

        option.type = "button";
        option.className = "chat-mention-option";

        if (index === selectedMentionIndex) {
            option.classList.add("selected");
        }

        const name = document.createElement("span");

        name.textContent = item.name || "Usuario";

        const type = document.createElement("small");

        type.textContent =
            item.type === "role" ? "Rol" : "Usuario";

        option.appendChild(name);
        option.appendChild(type);

        option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            selectMention(index);
        });

        option.addEventListener("touchstart", (event) => {
            event.preventDefault();
            selectMention(index);
        }, { passive: false });

        chatMentionsList.appendChild(option);

    });

    chatMentionsList.hidden = false;
}

// ======================================
// MOVER SELECCIÓN
// ======================================

function moveMentionSelection(direction) {

    if (mentionResults.length === 0) return;

    selectedMentionIndex += direction;

    if (selectedMentionIndex < 0) {
        selectedMentionIndex = mentionResults.length - 1;
    }

    if (selectedMentionIndex >= mentionResults.length) {
        selectedMentionIndex = 0;
    }

    renderMentions();
}

// ======================================
// INSERTAR MENCIÓN
// ======================================

function selectMention(index) {

    const item = mentionResults[index];

    if (!item || !currentMention) return;

    const value = chatInput.value;

    const before = value.slice(0, currentMention.start);
    const after = value.slice(currentMention.end);

    let mentionText;

    if (item.type === "role") {
        mentionText = `<@&${item.id}>`;
    } else {
        mentionText = `<@${item.id}>`;
    }

    const newValue =
        before + mentionText + " " + after;

    chatInput.value = newValue;

    const newCursor =
        before.length + mentionText.length + 1;

    chatInput.focus();

    chatInput.setSelectionRange(
        newCursor,
        newCursor
    );

    hideMentions();
}

// ======================================
// OCULTAR MENCIONES
// ======================================

function hideMentions() {

    if (!chatMentionsList) return;

    chatMentionsList.hidden = true;
    chatMentionsList.innerHTML = "";

    mentionResults = [];
    selectedMentionIndex = 0;
    currentMention = null;

    mentionSearchId++;
}

// ======================================
// SCROLL AL ÚLTIMO MENSAJE
// ======================================

function scrollToBottom() {

    if (!chatMessages) return;

    requestAnimationFrame(() => {

        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    });
}

// ======================================
// CERRAR CHAT
// ======================================

export function closeChat() {

    if (chatStream) {

        chatStream.close();
        chatStream = null;

    }

    if (searchTimeout) {

        clearTimeout(searchTimeout);
        searchTimeout = null;

    }

    hideMentions();

    console.log("[CHAT] Chat cerrado.");
}