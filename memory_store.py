import json
import os

MEMORY_FILE = "memory.json"


def load_memory():
    """Load memory from JSON file"""
    if not os.path.exists(MEMORY_FILE):
        return {}
    with open(MEMORY_FILE, "r", encoding="utf-8") as file:
        try:
            return json.load(file)
        except json.JSONDecodeError:
            return {}


def save_memory(memory):
    """Save memory to JSON file"""
    with open(MEMORY_FILE, "w", encoding="utf-8") as file:
        json.dump(memory, file, indent=4)


def get_user_memory(user_id: str) -> list[str]:
    """Get list of remembered facts for a user"""
    memory = load_memory()
    return memory.get(user_id, {}).get("facts", [])


def add_user_fact(user_id: str, fact: str):
    """Append a new fact for a user, avoiding exact duplicates"""
    memory = load_memory()
    user_data = memory.setdefault(user_id, {"facts": []})
    if fact not in user_data["facts"]:
        user_data["facts"].append(fact)
    save_memory(memory)