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

    def add_documents(self, documents: List[Document], batch_size: int = 50):
        """Add documents to the vector store with batching."""
        if not documents:
            return
            
        # Process documents in batches to avoid payload size limits
        total_docs = len(documents)
        for i in range(0, total_docs, batch_size):
            batch = documents[i : i + batch_size]
            print(f"Adding batch {i//batch_size + 1}/{(total_docs + batch_size - 1)//batch_size} (size: {len(batch)})")
            self.vector_db.add_documents(batch)
            
        self.vector_db.persist()

    def delete_documents_by_file_id(self, file_id: str):
        """Delete documents by file_id (stored in metadata)."""
        # Note: Chroma expects a filter dictionary
        # We assume that when adding documents, we add metadata={"file_id": str(db_doc.id)}
        try:
            self.vector_db._collection.delete(where={"file_id": file_id})
            self.vector_db.persist()
            print(f"Deleted vectors for file_id: {file_id}")
        except Exception as e:
            print(f"Error deleting vectors for file_id {file_id}: {str(e)}")


    def similarity_search(self, query: str, k: int = 4) -> List[Document]:
        """Search for similar documents."""
        return self.vector_db.similarity_search(query, k=k)
