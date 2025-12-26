import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    CHROMA_PERSIST_DIRECTORY = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data/chroma_db")
    
    # Embedding Model Configuration
    EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    
    # LLM Configuration
    LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "gpt-3.5-turbo")
    
    # Mock Configuration
    USE_MOCK_RAG = os.getenv("USE_MOCK_RAG", "false").lower() == "true"
    
    def is_api_key_valid(self) -> bool:
        """Check if the API Key is valid (non-empty and ASCII only)."""
        if not self.OPENAI_API_KEY:
            return False
        # Check if it contains the default placeholder text
        if "在此处填入" in self.OPENAI_API_KEY:
            return False
        # Check for non-ASCII characters
        try:
            self.OPENAI_API_KEY.encode('ascii')
            return True
        except UnicodeEncodeError:
            return False
    
settings = Settings()
