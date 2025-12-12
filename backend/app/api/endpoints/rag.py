from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List
import shutil
import os
import uuid
from app.services.document_service import DocumentService
from app.services.vector_store import VectorStoreService
from app.services.rag_engine import RAGEngine
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document and process it."""
    try:
        # 1. Save file temporarily
        file_ext = os.path.splitext(file.filename)[1]
        temp_filename = f"{uuid.uuid4()}{file_ext}"
        temp_path = os.path.join("data", temp_filename)
        
        # Ensure data directory exists
        os.makedirs("data", exist_ok=True)
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Process document
        doc_service = DocumentService()
        chunks = doc_service.load_and_split(temp_path)
        
        # 3. Store vectors
        vector_service = VectorStoreService()
        vector_service.add_documents(chunks)
        
        # Cleanup
        os.remove(temp_path)
        
        return {"message": f"Successfully processed {file.filename}", "chunks": len(chunks)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with the RAG knowledge base."""
    try:
        rag_engine = RAGEngine()
        result = await rag_engine.aget_answer(request.query)
        
        sources = [doc.page_content[:200] + "..." for doc in result.get("source_documents", [])]
        
        return ChatResponse(
            answer=result["result"],
            sources=sources
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
