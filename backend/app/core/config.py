import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    CHROMA_PERSIST_DIRECTORY = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data/chroma_db")
    
    # Embedding Model Configuration
    EMBEDDING_MODEL_NAME = "text-embedding-3-small"
    
    # LLM Configuration
    LLM_MODEL_NAME = "gpt-3.5-turbo"
    
    # Mock Configuration
    USE_MOCK_RAG = os.getenv("USE_MOCK_RAG", "false").lower() == "true"
    
settings = Settings()
