// ==============================
// ARX AI Chat UI
// ==============================

const textarea = document.querySelector("textarea");
const sendBtn = document.querySelector(".chat-input button");
const chatArea = document.getElementById("chatArea");
const newChatBtn = document.querySelector(".new-chat");

// FastAPI URL
const API_URL = "http://127.0.0.1:8000/chat";

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
});

// Create Message
function createMessage(message, sender) {

    const div = document.createElement("div");

    div.className = sender;

    div.innerHTML = `
        <div class="message">
            ${message}
        </div>
    `;

    chatArea.appendChild(div);

    chatArea.scrollTop = chatArea.scrollHeight;

    return div;
}

// Typing
function typingAnimation(){

    const div = document.createElement("div");

    div.className="bot";

    div.innerHTML=`
    <div class="message typing">
        <span></span>
        <span></span>
        <span></span>
    </div>
    `;

    chatArea.appendChild(div);

    chatArea.scrollTop=chatArea.scrollHeight;

    return div;
}

// Send Message
async function sendMessage(){

    const text = textarea.value.trim();

    if(text==="") return;

    document.querySelector(".welcome").style.display="none";

    createMessage(text,"user");

    textarea.value="";
    textarea.style.height="auto";

    const typing = typingAnimation();

    try{

        const response = await fetch(API_URL,{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                message:text
            })
        });

        const data = await response.json();

        typing.remove();

        createMessage(data.response,"bot");

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