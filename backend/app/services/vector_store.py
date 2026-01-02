from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import FakeEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers.ensemble import EnsembleRetriever
from app.core.config import settings
from typing import List
from langchain_core.documents import Document
import jieba

def chinese_tokenizer(text):
    return list(jieba.cut(text))

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
            # self.vector_db.persist() # Deprecated in Chroma 0.4.x
            print(f"Deleted vectors for file_id: {file_id}")
        except Exception as e:
            print(f"Error deleting vectors for file_id {file_id}: {str(e)}")


    def similarity_search(self, query: str, k: int = 4) -> List[Document]:
        """Search for similar documents."""
        return self.vector_db.similarity_search(query, k=k)

    def get_retriever(self, search_type="similarity", k=4):
        """Get retriever based on search type."""
        chroma_retriever = self.vector_db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": k}
        )
        
        if search_type == "hybrid":
            try:
                # Get all documents from Chroma to build BM25 index
                # Note: This might be slow for large datasets
                collection_data = self.vector_db.get()
                texts = collection_data['documents']
                metadatas = collection_data['metadatas']
                
                if not texts:
                    print("Warning: No documents found in vector store for hybrid search fallback.")
                    return chroma_retriever

                # Reconstruct Document objects
                docs = []
                for i in range(len(texts)):
                    meta = metadatas[i] if metadatas and i < len(metadatas) else {}
                    # Ensure metadata is a dict
                    if meta is None:
                        meta = {}
                    docs.append(Document(page_content=texts[i], metadata=meta))
                
                # Build BM25 Retriever
                bm25_retriever = BM25Retriever.from_documents(
                    docs, 
                    preprocess_func=chinese_tokenizer
                )
                bm25_retriever.k = k
                
                # Create Ensemble Retriever
                ensemble_retriever = EnsembleRetriever(
                    retrievers=[bm25_retriever, chroma_retriever],
                    weights=[0.5, 0.5]
                )
                return ensemble_retriever
            except Exception as e:
                print(f"Error initializing hybrid retriever: {e}. Falling back to similarity search.")
                return chroma_retriever
                
        return chroma_retriever
