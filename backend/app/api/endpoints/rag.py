from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
import uuid
import logging
from app.services.document_service import DocumentService
from app.services.vector_store import VectorStoreService
from app.services.rag_engine import RAGEngine
from app.core.database import get_db
from app.models.document import DocumentModel
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a document and process it."""
    try:
        logger.info(f"Starting upload for file: {file.filename}")
        
        # 0. Create Database Record
        db_doc = DocumentModel(
            filename=file.filename,
            status="processing",
            file_size=0 # We'll update this later
        )
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        # 1. Save file temporarily
        file_ext = os.path.splitext(file.filename)[1]
        temp_filename = f"{uuid.uuid4()}{file_ext}"
        temp_path = os.path.join("data", temp_filename)
        
        # Ensure data directory exists
        os.makedirs("data", exist_ok=True)
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size = os.path.getsize(temp_path)
        db_doc.file_size = file_size
        db.commit()
        
        logger.info(f"File saved locally at {temp_path}")
            
        # 2. Process document
        doc_service = DocumentService()
        logger.info("Starting document loading and splitting...")
        # Use run_in_threadpool for blocking I/O operations
        chunks = await run_in_threadpool(doc_service.load_and_split, temp_path)
        logger.info(f"Document split into {len(chunks)} chunks")
        
        # Add file_id to metadata for all chunks
        for chunk in chunks:
            chunk.metadata["file_id"] = str(db_doc.id)
            chunk.metadata["filename"] = file.filename
        
        # 3. Store vectors
        vector_service = VectorStoreService()
        logger.info("Starting vector storage (embedding generation)...")
        # Use run_in_threadpool for blocking I/O operations
        await run_in_threadpool(vector_service.add_documents, chunks)
        logger.info("Vector storage completed")
        
        # Update DB status
        db_doc.status = "processed"
        db.commit()
        
        # Cleanup
        os.remove(temp_path)
        logger.info("Temporary file cleaned up")
        
        return {"message": f"Successfully processed {file.filename}", "chunks": len(chunks), "doc_id": db_doc.id}
        
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}", exc_info=True)
        # Update DB status to error
        if 'db_doc' in locals():
            db_doc.status = "error"
            db.commit()
            
        # Clean up temp file if it exists and error occurred
        if 'temp_path' in locals() and os.path.exists(temp_path):
             os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import StreamingResponse
import json

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

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Chat with the RAG knowledge base (Streaming)."""
    try:
        rag_engine = RAGEngine()
        
        async def generate():
            async for chunk in rag_engine.astream_answer_generator(request.query):
                # Ensure we send valid JSON in SSE format
                yield f"data: {json.dumps(chunk)}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
        
    except Exception as e:
        logger.error(f"Error in chat stream: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
