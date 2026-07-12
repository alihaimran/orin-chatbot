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
    Uses Chroma's lightweight built-in embedding function so we
    don't need to download PyTorch/CUDA, which is too heavy for
    free-tier memory limits.
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


def retrieve_context(query: str, n_results: int = 4) -> str:
    """
    Looks through our knowledge base for chunks that are relevant
    to whatever the user just asked. Returns them as one combined
    block of text, ready to hand to the model.
    """
    try:
        results = get_collection().query(query_texts=[query], n_results=n_results)
    except Exception:
        return ""
    if not results.get("documents") or not results["documents"][0]:
        return ""
    return "\n\n---\n\n".join(results["documents"][0])


def build_system_prompt(context: str) -> str:
    """
    Builds the instructions we send to the model before every
    conversation. If we found relevant context, we hand it over
    and tell the model to lean on it. If not, it just answers
    normally.
    """
    if not context:
        return (
            "You are Orin, a helpful AI assistant. "
            "Answer clearly and concisely."
        )
    return f"""You are Orin, a helpful AI assistant that answers using the knowledge base below when relevant.
Knowledge base context:
{context}
Instructions:
- Prefer the context above when it's relevant to the question.
- If the context doesn't cover the question, answer from general knowledge and say so.
- Be concise, clear, and accurate. Don't invent facts."""


@app.get("/")
async def root():
    return {"status": "Orin chatbot API is running"}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    Main chat endpoint. Streams the response back word-by-word
    so the frontend can show it typing in real time, instead of
    waiting for the whole answer to be ready.
    """
    context = retrieve_context(req.message)
    system_prompt = build_system_prompt(context)

    messages = [{"role": "system", "content": system_prompt}]
    messages += req.history
    messages.append({"role": "user", "content": req.message})

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
    A simpler, non-streaming version of the chat endpoint.
    Useful as a fallback, or if you're testing the API directly
    without a frontend that supports streaming.
    """
    context = retrieve_context(req.message)
    system_prompt = build_system_prompt(context)

    messages = [{"role": "system", "content": system_prompt}]
    messages += req.history
    messages.append({"role": "user", "content": req.message})

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=1024,
    )
    return {"reply": response.choices[0].message.content}