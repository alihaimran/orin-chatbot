// ==============================
// Orin Chat UI
// ==============================

const textarea = document.querySelector("textarea");
const sendBtn = document.getElementById("sendBtn");
const chatArea = document.getElementById("chatArea");
const newChatBtn = document.querySelector(".new-chat");
const chatHistoryEl = document.getElementById("chatHistory");
const chatTitleEl = document.getElementById("chatTitle");
const welcomeEl = document.querySelector(".welcome");

const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");
const fileNameSpan = document.getElementById("fileName");
const removeFileBtn = document.getElementById("removeFile");

const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const viewAllBtn = document.getElementById("viewAllBtn");
const themeToggle = document.getElementById("themeToggle");
const topMenuBtn = document.getElementById("topMenuBtn");
const topMenuDropdown = document.getElementById("topMenuDropdown");
const exportChatBtn = document.getElementById("exportChatBtn");
const clearCurrentChatBtn = document.getElementById("clearCurrentChatBtn");
const deleteCurrentChatBtn = document.getElementById("deleteCurrentChatBtn");

// FastAPI URL (live backend)
const API_URL = "https://orin-chatbot.fastapicloud.dev/chat";

// Currently attached file (name + text content)
let attachedFile = null;

// ==============================
// Chat History (persisted in localStorage)
// ==============================

const STORAGE_KEY = "orin_chats";
const THEME_KEY = "orin_theme";

let chats = loadChats();
let currentChatId = null;

function loadChats(){
    try{
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch(e){
        return [];
    }
}

function saveChats(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function getCurrentChat(){
    return chats.find(c => c.id === currentChatId) || null;
}

function makeTitle(text){
    if (!text) return "Attached file";
    const trimmed = text.trim();
    return trimmed.length > 32 ? trimmed.slice(0, 32) + "…" : trimmed;
}

function formatTime(timestamp){
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Builds a plain-text transcript of everything said so far in this chat
function buildHistoryPrompt(chat){

    if (!chat || chat.messages.length === 0) return "";

    const lines = chat.messages.map(m => {
        const role = m.sender === "user" ? "User" : "Assistant";
        return `${role}: ${m.text}`;
    });

    return "Previous conversation so far:\n" + lines.join("\n") + "\n\n";
}

function renderHistory(){

    chatHistoryEl.innerHTML = "";

    if (chats.length === 0){
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "No conversations yet";
        chatHistoryEl.appendChild(empty);
        return;
    }

    chats.forEach(chat => {

        const item = document.createElement("div");
        item.className = "history-item" + (chat.id === currentChatId ? " active" : "");

        item.innerHTML = `
            <i class="fa-regular fa-message"></i>
            <span>${escapeHTML(chat.title)}</span>
            <i class="fa-regular fa-pen-to-square history-edit" title="Rename"></i>
            <i class="fa-solid fa-xmark history-delete" title="Delete"></i>
        `;

        item.addEventListener("click", () => switchChat(chat.id));

        item.querySelector(".history-edit").addEventListener("click", (e) => {
            e.stopPropagation();
            renameChat(chat.id);
        });

        item.querySelector(".history-delete").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        chatHistoryEl.appendChild(item);

    });
}

function renameChat(id){

    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    const input = prompt("Rename conversation:", chat.title);
    if (input === null) return;

    const trimmed = input.trim();
    if (trimmed === "") return;

    chat.title = trimmed.length > 32 ? trimmed.slice(0, 32) + "…" : trimmed;
    saveChats();

    if (currentChatId === id){
        chatTitleEl.textContent = chat.title;
    }

    renderHistory();
}

function escapeHTML(str){
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function switchChat(id){

    currentChatId = id;
    const chat = getCurrentChat();

    if (!chat) return;

    chatTitleEl.textContent = chat.title;
    chatArea.innerHTML = "";

    if (chat.messages.length === 0){
        welcomeEl.style.display = "block";
    } else {
        welcomeEl.style.display = "none";
        chat.messages.forEach(m => renderMessage(m.text, m.sender, m.fileTag, m.time));
    }

    renderHistory();
    closeMobileSidebar();
}

function deleteChat(id){

    chats = chats.filter(c => c.id !== id);
    saveChats();

    if (currentChatId === id){
        startNewChat();
        return;
    }

    renderHistory();
}

function startNewChat(){
    currentChatId = null;
    chatArea.innerHTML = "";
    chatTitleEl.textContent = "New Conversation";
    welcomeEl.style.display = "block";
    clearAttachedFile();
    renderHistory();
    closeMobileSidebar();
}

function closeMobileSidebar(){
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
}

// Initial render
renderHistory();

// Auto Height
textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
});

// Enter to Send
textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener("click", sendMessage);
newChatBtn.addEventListener("click", startNewChat);

// ==============================
// Sidebar: Clear all history / View all
// ==============================

clearHistoryBtn.addEventListener("click", () => {
    if (chats.length === 0) return;
    if (confirm("Delete all conversations? This can't be undone.")) {
        chats = [];
        saveChats();
        startNewChat();
    }
});

viewAllBtn.addEventListener("click", () => {
    chatHistoryEl.classList.toggle("expanded");
    const chevron = viewAllBtn.querySelector(".fa-chevron-right, .fa-chevron-down");
    if (chevron) {
        chevron.classList.toggle("fa-chevron-right");
        chevron.classList.toggle("fa-chevron-down");
    }
});

// ==============================
// Topbar: theme toggle + 3-dot menu
// ==============================

function applyTheme(theme){
    document.body.classList.toggle("light-theme", theme === "light");
    const icon = themeToggle.querySelector("i");
    icon.className = theme === "light" ? "fa-solid fa-moon" : "fa-solid fa-sun";
}

let currentTheme = localStorage.getItem(THEME_KEY) || "dark";
applyTheme(currentTheme);

themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, currentTheme);
    applyTheme(currentTheme);
});

topMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    topMenuDropdown.classList.toggle("show");
});

document.addEventListener("click", () => {
    topMenuDropdown.classList.remove("show");
});

exportChatBtn.addEventListener("click", () => {
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) {
        alert("No conversation to export yet.");
        return;
    }
    const text = chat.messages
        .map(m => `${m.sender === "user" ? "You" : "Orin"} (${m.time ? formatTime(m.time) : ""}): ${m.text}`)
        .join("\n\n");
    downloadTextFile(`${chat.title || "chat"}.txt`, text);
});

clearCurrentChatBtn.addEventListener("click", () => {
    const chat = getCurrentChat();
    if (!chat) return;
    if (confirm("Clear all messages in this chat?")) {
        chat.messages = [];
        saveChats();
        chatArea.innerHTML = "";
        welcomeEl.style.display = "block";
    }
});

deleteCurrentChatBtn.addEventListener("click", () => {
    if (!currentChatId) return;
    if (confirm("Delete this conversation?")) {
        deleteChat(currentChatId);
    }
});

function downloadTextFile(filename, text){
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ==============================
// File Attach Handling
// ==============================

attachBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", () => {

    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
        alert("File is too large. Please choose a file under 200KB.");
        fileInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        attachedFile = {
            name: file.name,
            content: reader.result
        };

        fileNameSpan.textContent = file.name;
        filePreview.style.display = "flex";
    };

    reader.onerror = () => {
        alert("Could not read this file.");
    };

    reader.readAsText(file);

});

removeFileBtn.addEventListener("click", clearAttachedFile);

function clearAttachedFile() {
    attachedFile = null;
    fileInput.value = "";
    filePreview.style.display = "none";
    fileNameSpan.textContent = "";
}

// ==============================
// Message Rendering
// ==============================

function renderMessage(message, sender, fileTag, time) {

    const timestamp = time || Date.now();

    if (sender === "user") {

        const div = document.createElement("div");
        div.className = "user";

        const content = document.createElement("div");
        content.className = "user-content";

        const bubble = document.createElement("div");
        bubble.className = "message";

        if (fileTag){
            const tag = document.createElement("div");
            tag.className = "file-attached-tag";
            tag.innerHTML = `<i class="fa-solid fa-paperclip"></i> ${escapeHTML(fileTag)}`;
            bubble.appendChild(tag);
            bubble.appendChild(document.createElement("br"));
        }

        const textSpan = document.createElement("span");
        textSpan.textContent = message;
        bubble.appendChild(textSpan);

        const meta = document.createElement("div");
        meta.className = "user-meta";
        meta.innerHTML = `<span>${formatTime(timestamp)}</span><i class="fa-solid fa-check-double read-receipt"></i>`;

        content.appendChild(bubble);
        content.appendChild(meta);
        div.appendChild(content);

        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;

        return div;
    }

    // Bot message
    const div = document.createElement("div");
    div.className = "bot";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "O";

    const content = document.createElement("div");
    content.className = "bot-content";

    const bubble = document.createElement("div");
    bubble.className = "message";

    const textSpan = document.createElement("span");
    textSpan.textContent = message;
    bubble.appendChild(textSpan);

    const timeEl = document.createElement("div");
    timeEl.className = "msg-time";
    timeEl.textContent = formatTime(timestamp);

    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action";
    copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`;
    copyBtn.addEventListener("click", () => copyMessage(message, copyBtn));

    const divider = document.createElement("span");
    divider.className = "msg-action-divider";
    divider.textContent = "|";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "msg-action";
    downloadBtn.innerHTML = `<i class="fa-solid fa-download"></i> Download`;
    downloadBtn.addEventListener("click", () => downloadTextFile("orin-reply.txt", message));

    actions.appendChild(copyBtn);
    actions.appendChild(divider);
    actions.appendChild(downloadBtn);

    content.appendChild(bubble);
    content.appendChild(timeEl);
    content.appendChild(actions);

    div.appendChild(avatar);
    div.appendChild(content);

    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;

    return div;
}

function copyMessage(text, btn){
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied`;
        setTimeout(() => {
            btn.innerHTML = original;
        }, 1200);
    });
}

// Renders AND saves the message into the active chat
function createMessage(message, sender, fileTag) {

    const time = Date.now();
    const div = renderMessage(message, sender, fileTag, time);

    const chat = getCurrentChat();

    if (chat){
        chat.messages.push({ sender, text: message, fileTag: fileTag || null, time });
        saveChats();
    }

    return div;
}

// Typing
function typingAnimation(){

    const div = document.createElement("div");
    div.className = "bot";

    div.innerHTML = `
        <div class="avatar">O</div>
        <div class="message typing">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;

    return div;
}

// Send Message
async function sendMessage(){

    const text = textarea.value.trim();

    if (text === "" && !attachedFile) return;

    welcomeEl.style.display = "none";

    if (currentChatId === null){

        const chat = {
            id: Date.now(),
            title: makeTitle(text || (attachedFile ? attachedFile.name : "New chat")),
            messages: []
        };

        chats.unshift(chat);
        currentChatId = chat.id;
        chatTitleEl.textContent = chat.title;
        saveChats();
        renderHistory();
    }

    const chatForHistory = getCurrentChat();
    const historyPrompt = buildHistoryPrompt(chatForHistory);

    createMessage(text || "(sent a file)", "user", attachedFile ? attachedFile.name : null);

    let messageToSend = text;

    if (attachedFile) {
        messageToSend =
            `The user attached a file named "${attachedFile.name}" with the following content:\n\n` +
            `${attachedFile.content}\n\n` +
            `User's message: ${text || "(no additional message, just discuss the file)"}`;
    }

    if (historyPrompt){
        messageToSend = historyPrompt + "User: " + messageToSend;
    }

    textarea.value = "";
}