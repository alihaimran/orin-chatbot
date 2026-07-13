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

// FastAPI URL (live backend)
const API_URL = "https://orin-chatbot.fastapicloud.dev/chat";

// Currently attached file (name + text content)
let attachedFile = null;

// ==============================
// Chat History (persisted in localStorage)
// ==============================

const STORAGE_KEY = "orin_chats";

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

// Builds a plain-text transcript of everything said so far in this chat,
// so it can be sent to the backend and the bot has memory of the conversation.
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
        chat.messages.forEach(m => renderMessage(m.text, m.sender, m.fileTag));
    }

    renderHistory();
    closeMobileSidebar();
}

function deleteChat(id){

    chats = chats.filter(c => c.id !== id);
    saveChats();

    if (currentChatId === id){
        currentChatId = null;
        chatArea.innerHTML = "";
        chatTitleEl.textContent = "New Conversation";
        welcomeEl.style.display = "block";
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

// Send Button
sendBtn.addEventListener("click", sendMessage);

// New Chat
newChatBtn.addEventListener("click", startNewChat);

// ==============================
// File Attach Handling
// ==============================

attachBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", () => {

    const file = fileInput.files[0];

    if (!file) return;

    // Keep it simple: limit size to ~200KB of text
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
// Message Rendering (visual only, no persistence)
// ==============================

function renderMessage(message, sender, fileTag) {

    const div = document.createElement("div");
    div.className = sender;

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

    div.appendChild(bubble);

    // Voice + Copy actions (bot messages only)
    if (sender === "bot"){

        const actions = document.createElement("div");
        actions.className = "msg-actions";

        const speakBtn = document.createElement("i");
        speakBtn.className = "fa-solid fa-volume-high msg-action-icon";
        speakBtn.title = "Listen";
        speakBtn.addEventListener("click", () => speakMessage(message, speakBtn));

        const copyBtn = document.createElement("i");
        copyBtn.className = "fa-regular fa-copy msg-action-icon";
        copyBtn.title = "Copy";
        copyBtn.addEventListener("click", () => copyMessage(message, copyBtn));

        actions.appendChild(speakBtn);
        actions.appendChild(copyBtn);
        div.appendChild(actions);
    }

    chatArea.appendChild(div);

    chatArea.scrollTop = chatArea.scrollHeight;

    return div;
}

function speakMessage(text, btn){

    if (!("speechSynthesis" in window)){
        alert("Voice playback isn't supported in this browser.");
        return;
    }

    if (window.speechSynthesis.speaking){
        window.speechSynthesis.cancel();
        btn.classList.remove("fa-volume-xmark");
        btn.classList.add("fa-volume-high");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onend = () => {
        btn.classList.remove("fa-volume-xmark");
        btn.classList.add("fa-volume-high");
    };

    btn.classList.remove("fa-volume-high");
    btn.classList.add("fa-volume-xmark");

    window.speechSynthesis.speak(utterance);
}

function copyMessage(text, btn){

    navigator.clipboard.writeText(text).then(() => {
        btn.classList.remove("fa-regular");
        btn.classList.add("fa-solid");
        btn.title = "Copied!";

        setTimeout(() => {
            btn.classList.remove("fa-solid");
            btn.classList.add("fa-regular");
            btn.title = "Copy";
        }, 1200);
    });
}

// Renders AND saves the message into the active chat
function createMessage(message, sender, fileTag) {

    const div = renderMessage(message, sender, fileTag);

    const chat = getCurrentChat();

    if (chat){
        chat.messages.push({ sender, text: message, fileTag: fileTag || null });
        saveChats();
    }

    return div;
}

// Typing
function typingAnimation(){

    const div = document.createElement("div");

    div.className = "bot";

    div.innerHTML = `
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

    // If this is the first message of a fresh chat, create the conversation now
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

    // Grab everything said so far in this chat BEFORE we add the new message
    const chatForHistory = getCurrentChat();
    const historyPrompt = buildHistoryPrompt(chatForHistory);

    // What the user sees in the chat bubble (also persisted)
    createMessage(text || "(sent a file)", "user", attachedFile ? attachedFile.name : null);

    // What actually gets sent to the backend
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
    textarea.style.height = "auto";
    clearAttachedFile();

    const typing = typingAnimation();

    try{

        const response = await fetch(API_URL,{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                message: messageToSend
            })
        });

        const data = await response.json();

        typing.remove();

        createMessage(data.reply, "bot");

    }
    catch(error){

        typing.remove();

        createMessage(
            "⚠ Unable to connect to FastAPI server.",
            "bot"
        );

        console.error(error);

    }

}
// ==============================
// Mobile Sidebar Toggle
// ==============================

const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("show");
});

sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
});