from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import FakeEmbeddings
from app.core.config import settings
from typing import List
from langchain_core.documents import Document

class VectorStoreService:
    def __init__(self):
        if settings.USE_MOCK_RAG or not settings.is_api_key_valid():
            if not settings.USE_MOCK_RAG:
                print("Warning: Invalid or missing OpenAI API Key. Fallback to Mock Embeddings.")
            # Mock embeddings with same dimension as text-embedding-3-small (1536)
            self.embeddings = FakeEmbeddings(size=1536)
        else:
            self.embeddings = OpenAIEmbeddings(
                model=settings.EMBEDDING_MODEL_NAME,
                openai_api_key=settings.OPENAI_API_KEY,
                openai_api_base=settings.OPENAI_API_BASE,
                timeout=60
            )
        self.vector_db = Chroma(
            persist_directory=settings.CHROMA_PERSIST_DIRECTORY,
            embedding_function=self.embeddings
        )

    def add_documents(self, documents: List[Document]):
        """Add documents to the vector store."""
        if not documents:
            return
        self.vector_db.add_documents(documents)
        self.vector_db.persist()

    def similarity_search(self, query: str, k: int = 4) -> List[Document]:
        """Search for similar documents."""
        return self.vector_db.similarity_search(query, k=k)
