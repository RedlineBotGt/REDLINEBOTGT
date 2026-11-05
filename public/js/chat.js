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
let chatInitialized = false;

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

    // Evitar registrar los mismos eventos más de una vez.
    if (!chatInitialized) {

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

        chatSendButton.addEventListener("click", (event) => {

            event.preventDefault();

            if (Date.now() - lastPointerSendAt < 800) {
                return;
            }

            sendMessage();

        });

        chatForm.addEventListener("submit", (event) => {
            event.preventDefault();
            sendMessage();
        });

        chatInput.addEventListener("keydown", handleInputKeydown);
        chatInput.addEventListener("input", handleInputChange);

        chatInitialized = true;
    }

    loadMessages();
    connectChatStream();

    console.log("[CHAT] Interfaz inicializada.");
}

// ======================================
// CERRAR CHAT
// ======================================

// El menú llama a esta función al cambiar de apartado.
// Mantenemos la conexión SSE activa para que, al volver
// al chat, no sea necesario registrar de nuevo los eventos.

export function closeChat() {
    hideMentionSuggestions();
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
        renderedMessageIds.clear();

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
                "[CHAT] Error leyendo mensaje:",
                error
            );

        }

    });

    chatStream.onerror = () => {
        console.warn("[CHAT] Conexión interrumpida. Reconectando...");
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
    const loading = chatMessages.querySelector(".chat-loading");

    if (empty) empty.remove();
    if (loading) loading.remove();

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

    // TEXTO Y MENCIONES

    const text = document.createElement("div");
    text.className = "chat-message-text";

    renderMessageText(
        text,
        message.content || "",
        message.mentionData || {}
    );

    content.appendChild(header);
    content.appendChild(text);

    messageElement.appendChild(avatar);
    messageElement.appendChild(content);

    chatMessages.appendChild(messageElement);
}

// ======================================
// INTERPRETAR MENCIONES DE DISCORD
// ======================================

function renderMessageText(element, message, mentionData = {}) {

    const regex = /<@!?(\\d+)>|<@&(\\d+)>|<#(\\d+)>/g;

    const users = mentionData.users || [];
    const roles = mentionData.roles || [];
    const channels = mentionData.channels || [];

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

        let mentionElement;

        // USUARIO

        if (match[1]) {

            const id = match[1];

            const user = users.find(
                item => String(item.id) === id
            );

            const name = user?.name || "usuario";

            mentionElement = document.createElement("a");
            mentionElement.className = "chat-mention chat-mention-user";
            mentionElement.href = `https://discord.com/users/${id}`;
            mentionElement.target = "_blank";
            mentionElement.rel = "noopener noreferrer";
            mentionElement.textContent = `@${name}`;
            mentionElement.title = `Abrir perfil de ${name}`;

        }

        // ROL

        else if (match[2]) {

            const id = match[2];

            const role = roles.find(
                item => String(item.id) === id
            );

            const name = role?.name || "rol";

            mentionElement = document.createElement("span");
            mentionElement.className = "chat-mention chat-mention-role";
            mentionElement.textContent = `@${name}`;
            mentionElement.title = `Rol: ${name}`;

        }

        // CANAL

        else {

            const id = match[3];

            const channel = channels.find(
                item => String(item.id) === id
            );

            const name = channel?.name || "canal";

            mentionElement = document.createElement("a");
            mentionElement.className = "chat-mention chat-mention-channel";
            mentionElement.href =
                channel?.url ||
                `https://discord.com/channels/@me/${id}`;

            mentionElement.target = "_blank";
            mentionElement.rel = "noopener noreferrer";
            mentionElement.textContent = `#${name}`;
            mentionElement.title = `Abrir canal ${name}`;

        }

        element.appendChild(mentionElement);

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

    if (content.length > 1997) {
        alert("El mensaje supera el límite permitido.");
        return;
    }

    sendingMessage = true;
    chatSendButton.disabled = true;

    try {

        const response = await fetch(`${CHAT_API}/messages`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "No se pudo enviar el mensaje."
            );
        }

        chatInput.value = "";
        chatInput.style.height = "auto";

        hideMentionSuggestions();

        if (data.message) {
            renderMessage(data.message);
        }

        scrollToBottom();

    } catch (error) {

        console.error("[CHAT] Error enviando:", error);

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

    if (currentMention && mentionResults.length > 0) {

        if (event.key === "ArrowDown") {

            event.preventDefault();

            selectedMentionIndex =
                (selectedMentionIndex + 1) % mentionResults.length;

            renderMentionSuggestions();
            return;
        }

        if (event.key === "ArrowUp") {

            event.preventDefault();

            selectedMentionIndex =
                (selectedMentionIndex - 1 + mentionResults.length) %
                mentionResults.length;

            renderMentionSuggestions();
            return;
        }

        if (event.key === "Enter" || event.key === "Tab") {

            event.preventDefault();

            selectMention(mentionResults[selectedMentionIndex]);
            return;
        }

        if (event.key === "Escape") {

            hideMentionSuggestions();
            return;
        }
    }

    if (event.key === "Enter" && !event.shiftKey) {

        event.preventDefault();
        sendMessage();

    }
}

// ======================================
// DETECTAR @USUARIOS, @ROLES Y #CANALES
// ======================================

function handleInputChange() {

    const cursor = chatInput.selectionStart;
    const textBeforeCursor = chatInput.value.slice(0, cursor);

    clearTimeout(searchTimeout);

    // Buscar el último @ o # escrito.
    const match = textBeforeCursor.match(/(^|\s)([@#])([^\s@#]*)$/);

    if (!match) {

        hideMentionSuggestions();
        return;
    }

    const trigger = match[2];
    const query = match[3];

    if (!query || query.length < 1) {

        hideMentionSuggestions();
        return;
    }

    const start = cursor - query.length - 1;

    currentMention = {
        trigger,
        query,
        start,
        end: cursor,
        type: trigger === "#" ? "channel" : "user"
    };

    searchTimeout = setTimeout(() => {
        searchMentions(query, currentMention.type);
    }, 250);
}

// ======================================
// BUSCAR MENCIONES
// ======================================

async function searchMentions(query, type) {

    const searchId = ++mentionSearchId;

    try {

        const response = await fetch(
            `${CHAT_API}/mentions?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`,
            {
                credentials: "same-origin"
            }
        );

        const data = await response.json();

        if (searchId !== mentionSearchId) return;

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Error buscando menciones."
            );
        }

        mentionResults = data.results || [];
        selectedMentionIndex = 0;

        renderMentionSuggestions();

    } catch (error) {

        console.error("[CHAT] Error buscando menciones:", error);

        mentionResults = [];
        renderMentionSuggestions();

    }
}

// ======================================
// MOSTRAR SUGERENCIAS
// ======================================

function renderMentionSuggestions() {

    chatMentionsList.innerHTML = "";

    if (!mentionResults.length) {

        chatMentionsList.innerHTML = `
            <div class="chat-mention-empty">
                No hay coincidencias
            </div>
        `;

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

        if (item.avatar) {

            const avatar = document.createElement("img");

            avatar.src = item.avatar;
            avatar.alt = "";
            avatar.onerror = () => avatar.remove();

            option.appendChild(avatar);

        }

        const name = document.createElement("span");

        name.className = "chat-mention-option-name";
        name.textContent = item.name;

        const type = document.createElement("span");

        type.className = "chat-mention-option-type";

        type.textContent =
            item.type === "role"
                ? "ROL"
                : item.type === "channel"
                    ? "CANAL"
                    : "USUARIO";

        option.appendChild(name);
        option.appendChild(type);

        option.addEventListener("pointerdown", (event) => {

            event.preventDefault();
            selectMention(item);

        });

        chatMentionsList.appendChild(option);

    });

    chatMentionsList.hidden = false;
}

// ======================================
// INSERTAR MENCIÓN SELECCIONADA
// ======================================

function selectMention(item) {

    if (!currentMention || !item) return;

    let mentionText;

    if (item.type === "role") {

        mentionText = `<@&${item.id}>`;

    } else if (item.type === "channel") {

        mentionText = `<#${item.id}>`;

    } else {

        mentionText = `<@${item.id}>`;

    }

    const before = chatInput.value.slice(
        0,
        currentMention.start
    );

    const after = chatInput.value.slice(
        currentMention.end
    );

    const separator = after.startsWith(" ") ? "" : " ";

    chatInput.value =
        before + mentionText + separator + after;

    const newCursor =
        before.length + mentionText.length + separator.length;

    chatInput.focus();

    chatInput.setSelectionRange(
        newCursor,
        newCursor
    );

    hideMentionSuggestions();
}

// ======================================
// OCULTAR SUGERENCIAS
// ======================================

function hideMentionSuggestions() {

    if (chatMentionsList) {

        chatMentionsList.hidden = true;
        chatMentionsList.innerHTML = "";

    }

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