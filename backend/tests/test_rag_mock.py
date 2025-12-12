import sys
import os
import shutil
from unittest.mock import MagicMock, patch

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Set fake API key for testing to bypass validation
os.environ["OPENAI_API_KEY"] = "sk-fake-key-for-testing-only"
os.environ["OPENAI_API_BASE"] = "https://api.openai.com/v1"

from app.services.document_service import DocumentService
from app.services.vector_store import VectorStoreService
from app.services.rag_engine import RAGEngine
from app.core.config import settings

def mock_embeddings(texts):
    # Return fake embeddings of dimension 1536 (typical for openai)
    return [[0.1] * 1536 for _ in texts]

def mock_embedding_query(text):
    return [0.1] * 1536

def test_rag_pipeline_mock():
    print("Testing RAG Pipeline (MOCK)...")
    
    # 0. Clean up previous vector store
    if os.path.exists(settings.CHROMA_PERSIST_DIRECTORY):
        shutil.rmtree(settings.CHROMA_PERSIST_DIRECTORY)
        print("Cleaned up previous vector store.")

    # 1. Load and Split Document
    print("\n1. Loading and splitting document...")
    doc_service = DocumentService()
    file_path = os.path.join(os.path.dirname(__file__), '../data/test_doc.txt')
    chunks = doc_service.load_and_split(file_path)
    print(f"Generated {len(chunks)} chunks.")
    
    # Mocking OpenAIEmbeddings
    with patch('app.services.vector_store.OpenAIEmbeddings') as MockEmbeddings:
        mock_instance = MockEmbeddings.return_value
        mock_instance.embed_documents.side_effect = mock_embeddings
        mock_instance.embed_query.side_effect = mock_embedding_query
        
        # 2. Vector Store
        print("\n2. Storing vectors (Mocked)...")
        vector_service = VectorStoreService()
        # Ensure we are using the mocked instance
        vector_service.embeddings = mock_instance 
        # Re-initialize Chroma with mocked embeddings to avoid real API call during init if any
        # However, Chroma usually calls embedding function on add_documents.
        # We need to make sure vector_db uses the mocked embedding function.
        vector_service.vector_db._embedding_function = mock_instance
        
        vector_service.add_documents(chunks)
        print("Documents added to vector store.")
        
        # 3. Retrieval
        print("\n3. Testing retrieval (Mocked)...")
        query = "RAG 的主要优势是什么？"
        results = vector_service.similarity_search(query)
        print(f"Retrieved {len(results)} documents.")
        # Since embeddings are identical, it might return random or all documents
        for i, doc in enumerate(results):
            print(f"Doc {i+1}: {doc.page_content[:50]}...")
            
    # 4. Generation
    print("\n4. Testing generation (Mocked)...")
    with patch('app.services.rag_engine.ChatOpenAI') as MockChat:
        with patch('app.services.rag_engine.RetrievalQA') as MockQA:
            # Setup Mock QA Chain
            mock_chain = MagicMock()
            mock_chain.invoke.return_value = {
                "query": "query",
                "result": "这是一个模拟的回答：RAG 的优势在于结合了检索和生成。",
                "source_documents": chunks[:2]
            }
            MockQA.from_chain_type.return_value = mock_chain
            
            rag_engine = RAGEngine()
            answer = rag_engine.get_answer(query)
            print(f"\nQuery: {query}")
            print(f"Answer: {answer['result']}")
            
            # Verify Source Documents
            print("\nSource Documents:")
            for doc in answer['source_documents']:
                print(f"- {doc.page_content[:50]}...")

if __name__ == "__main__":
    test_rag_pipeline_mock()
