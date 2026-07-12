// ==============================
// ARX AI Chat UI
// ==============================

const textarea = document.querySelector("textarea");
const sendBtn = document.getElementById("sendBtn");
const chatArea = document.getElementById("chatArea");
const newChatBtn = document.querySelector(".new-chat");

const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");
const fileNameSpan = document.getElementById("fileName");
const removeFileBtn = document.getElementById("removeFile");

// FastAPI URL (live backend)
const API_URL = "https://orin-chatbot.fastapicloud.dev/chat";

// Currently attached file (name + text content)
let attachedFile = null;

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
newChatBtn.addEventListener("click", () => {
    chatArea.innerHTML = "";
    document.querySelector(".welcome").style.display = "block";
    clearAttachedFile();
});

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
// Message Rendering
// ==============================

function createMessage(message, sender, fileTag) {

    const div = document.createElement("div");

    div.className = sender;

    const avatarHTML = `
        <div class="avatar">
            ${sender === "bot" ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user"></i>'}
        </div>
    `;

    const fileTagHTML = fileTag
        ? `<div class="file-attached-tag"><i class="fa-solid fa-paperclip"></i> ${fileTag}</div><br>`
        : "";

    div.innerHTML = `
        ${avatarHTML}
        <div class="message">
            ${fileTagHTML}${message}
        </div>
    `;

    chatArea.appendChild(div);

    chatArea.scrollTop = chatArea.scrollHeight;

    return div;
}

// Typing
function typingAnimation(){

    const div = document.createElement("div");

    div.className = "bot";

    div.innerHTML = `
    <div class="avatar"><i class="fa-solid fa-robot"></i></div>
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

    document.querySelector(".welcome").style.display = "none";

    // What the user sees in the chat bubble
    createMessage(text || "(sent a file)", "user", attachedFile ? attachedFile.name : null);

    // What actually gets sent to the backend
    let messageToSend = text;

    if (attachedFile) {
        messageToSend =
            `The user attached a file named "${attachedFile.name}" with the following content:\n\n` +
            `${attachedFile.content}\n\n` +
            `User's message: ${text || "(no additional message, just discuss the file)"}`;
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