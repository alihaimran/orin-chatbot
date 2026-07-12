"""
Creates a small sample SQLite database with some test articles,
just so we have something to test our RAG pipeline with.
"""
import sqlite3
conn = sqlite3.connect("your_database.db")
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY,
        content TEXT
    )
""")
sample_data = [
    (1, "Orin is an AI assistant built to help users with their questions. It uses a knowledge base to give accurate, grounded answers instead of just guessing."),
    (2, "Our return policy allows customers to return products within 30 days of purchase, as long as the item is unused and in its original packaging."),
    (3, "To reset your password, go to the login page and click 'Forgot Password'. You'll receive an email with a link to set a new one."),
    (4, "Our office hours are Monday to Friday, 9 AM to 6 PM. We're closed on public holidays."),
    (5, "The premium plan includes unlimited chatbot messages, priority support, and access to advanced features like file uploads and voice input."),
]
cursor.executemany("INSERT INTO articles (id, content) VALUES (?, ?)", sample_data)
conn.commit()
conn.close()
print("Test database created: your_database.db")