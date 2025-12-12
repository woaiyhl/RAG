import sys
import os
import shutil

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.document_service import DocumentService
from app.services.vector_store import VectorStoreService
from app.services.rag_engine import RAGEngine
from app.core.config import settings

def test_rag_pipeline():
    print("Testing RAG Pipeline...")
    
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
    
    # 2. Vector Store
    print("\n2. Storing vectors...")
    vector_service = VectorStoreService()
    vector_service.add_documents(chunks)
    print("Documents added to vector store.")
    
    # 3. Retrieval
    print("\n3. Testing retrieval...")
    query = "RAG 的主要优势是什么？"
    results = vector_service.similarity_search(query)
    print(f"Retrieved {len(results)} documents.")
    for i, doc in enumerate(results):
        print(f"Doc {i+1}: {doc.page_content[:50]}...")
        
    # 4. Generation
    print("\n4. Testing generation...")
    rag_engine = RAGEngine()
    answer = rag_engine.get_answer(query)
    print(f"\nQuery: {query}")
    print(f"Answer: {answer['result']}")
    
    # Verify Source Documents
    print("\nSource Documents:")
    for doc in answer['source_documents']:
        print(f"- {doc.page_content[:50]}...")

if __name__ == "__main__":
    test_rag_pipeline()
