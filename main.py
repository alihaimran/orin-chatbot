import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import chromadb
from chromadb.utils import embedding_functions

from memory_store import get_user_memory, add_user_fact

load_dotenv()

app = FastAPI(title="Orin Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "KnowledgeBase"
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
_collection = None


def get_collection():
    """
    Loads the Chroma collection only when it's actually needed
    (on the first real request), instead of at server startup.
    """
    global _collection
    if _collection is None:
        embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        _collection = chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_fn,
        )
    return _collection


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    user_id: str = "default_user"


def retrieve_context(query: str, n_results: int = 4) -> str:
    """
    Looks through our knowledge base for chunks relevant to the query.
    """
    try:
        results = get_collection().query(query_texts=[query], n_results=n_results)
    except Exception:
        return ""
    if not results.get("documents") or not results["documents"][0]:
        return ""
    return "\n\n---\n\n".join(results["documents"][0])


def build_system_prompt(context: str, remembered_facts: list[str]) -> str:
    """
    Builds the instructions sent to the model before every conversation.
    Adds both knowledge-base context and long-term memory about the user.
    """
    memory_block = ""
    if remembered_facts:
        facts_str = "\n".join(f"- {fact}" for fact in remembered_facts)
        memory_block = f"\n\nThings you remember about this user from past conversations:\n{facts_str}"

    if not context:
        return (
            "You are Orin, a helpful AI assistant. "
            "Answer clearly and concisely."
            f"{memory_block}"
        )

    return f"""You are Orin, a helpful AI assistant that answers using the knowledge base below when relevant.
Knowledge base context:
{context}
{memory_block}

Instructions:
- Prefer the context above when it's relevant to the question.
- If the context doesn't cover the question, answer from general knowledge and say so.
- Be concise, clear, and accurate. Don't invent facts."""


def extract_and_store_fact(user_id: str, user_message: str):
    """
    Asks the model whether the user's message contains something worth
    remembering long-term (name, preference, recurring detail, etc.).
    If yes, stores it via memory_store. Runs as a lightweight side call
    so it doesn't slow down or break the main chat response.
    """
    try:
        extraction_prompt = (
            "Decide if the following user message contains a durable personal "
            "fact worth remembering for future conversations (e.g. their name, "
            "preferences, goals, ongoing projects). "
            "If yes, reply with ONLY that fact as a short single sentence. "
            "If no such fact exists, reply with exactly: NONE.\n\n"
            f"User message: \"{user_message}\""
        )
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": extraction_prompt}],
            max_tokens=60,
        )
        fact = response.choices[0].message.content.strip()
        if fact and fact.upper() != "NONE":
            add_user_fact(user_id, fact)
    except Exception:
        # Memory extraction is best-effort; never break the chat on failure
        pass


@app.get("/")
async def root():
    return {"status": "Orin chatbot API is running"}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    Main chat endpoint. Streams the response back word-by-word,
    and also updates long-term memory in the background.
    """
    context = retrieve_context(req.message)
    remembered_facts = get_user_memory(req.user_id)
    system_prompt = build_system_prompt(context, remembered_facts)

    messages = [{"role": "system", "content": system_prompt}]
    messages += req.history
    messages.append({"role": "user", "content": req.message})

    extract_and_store_fact(req.user_id, req.message)

    def generate():
        try:
            stream = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                stream=True,
                max_tokens=1024,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield f"data: {json.dumps({'text': delta})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Non-streaming version of the chat endpoint, with memory support.
    """
    context = retrieve_context(req.message)
    remembered_facts = get_user_memory(req.user_id)
    system_prompt = build_system_prompt(context, remembered_facts)

    messages = [{"role": "system", "content": system_prompt}]
    messages += req.history
    messages.append({"role": "user", "content": req.message})

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=1024,
    )

    extract_and_store_fact(req.user_id, req.message)

    return {"reply": response.choices[0].message.content}