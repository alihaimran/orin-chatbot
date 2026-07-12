"""
Knowledge Base Ingestion Script
---------------------------------
This script reads text data from our SQLite database and loads it
into ChromaDB, so Orin can search through it later (RAG).
Run this once to set things up, and run it again anytime the
underlying data changes — it'll just rebuild the collection.
Usage:
    python ingest.py
"""
import sqlite3
import chromadb
from chromadb.utils import embedding_functions
SQLITE_DB_PATH = "your_database.db"   
TABLE_NAME = "articles"               
ID_COLUMN = "id"                 
TEXT_COLUMN = "content"               
SOURCE_COLUMN = None                  

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "knowledge_base"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=embedding_fn,
)
def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Breaks a long piece of text into smaller overlapping chunks.
    The overlap helps make sure we don't accidentally cut a sentence
    or idea in half between two chunks.
    """
    words = text.split()
    if len(words) <= chunk_size:
        return [text]

    chunks = []
    step = max(chunk_size - overlap, 1)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks
def fetch_records_from_sqlite() -> list[dict]:
    """
    Grabs all the rows we care about from the SQLite database
    and turns them into a simple list of dicts we can work with.
    """
    conn = sqlite3.connect(SQLITE_DB_PATH)
    cursor = conn.cursor()
    columns = [ID_COLUMN, TEXT_COLUMN]
    if SOURCE_COLUMN:
        columns.append(SOURCE_COLUMN)
    query = f"SELECT {', '.join(columns)} FROM {TABLE_NAME}"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    records = []
    for row in rows:
        record = {"id": str(row[0]), "text": row[1] or ""}
        if SOURCE_COLUMN:
            record["source"] = row[2]
        records.append(record)
    return records
def ingest(records: list[dict]):
    """
    Takes our records, chunks up the text, and pushes everything
    into ChromaDB. We batch this so we don't overload memory if
    the dataset is large.
    """
    documents, metadatas, ids = [], [], []
    for record in records:
        if not record["text"].strip():
            continue
        chunks = chunk_text(record["text"])
        for idx, chunk in enumerate(chunks):
            documents.append(chunk)
            metadatas.append({
                "record_id": record["id"],
                "source": record.get("source", TABLE_NAME),
            })
            ids.append(f"{record['id']}_{idx}")
    if not documents:
        print("Didn't find any text to ingest — double check your table/column settings.")
        return
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        collection.add(
            documents=documents[i:i + batch_size],
            metadatas=metadatas[i:i + batch_size],
            ids=ids[i:i + batch_size],
        )
    print(f"Done — ingested {len(documents)} chunks from {len(records)} records.")
if __name__ == "__main__":
    print(f"Reading from {SQLITE_DB_PATH} → table '{TABLE_NAME}'...")
    records = fetch_records_from_sqlite()
    print(f"Found {len(records)} records.")
    ingest(records)