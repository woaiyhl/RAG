from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os

from app.core.database import get_db, engine
from app.models.document import DocumentModel, Base
from app.schemas.document import Document
from app.services.vector_store import VectorStoreService

# Create tables
Base.metadata.create_all(bind=engine)

router = APIRouter()

@router.get("/", response_model=List[Document])
def get_documents(db: Session = Depends(get_db)):
    """Get all documents."""
    return db.query(DocumentModel).order_by(DocumentModel.upload_time.desc()).all()

@router.get("/{document_id}/preview")
def get_document_preview(document_id: int, db: Session = Depends(get_db)):
    """Get document preview file."""
    document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Construct file path
    file_path = os.path.join("data", "uploads", f"{document.id}_{document.filename}")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(
        path=file_path,
        filename=document.filename,
        media_type="application/pdf" if document.filename.lower().endswith('.pdf') else "text/plain",
        content_disposition_type="inline"
    )

@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    """Delete a document by ID."""
    document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # 1. Delete from Vector Store
    try:
        vector_service = VectorStoreService()
        vector_service.delete_documents_by_file_id(str(document_id))
    except Exception as e:
        print(f"Error deleting vectors: {e}")
        # Continue to delete from DB even if vector deletion fails (to keep consistency)
        
    # 2. Delete file from storage
    try:
        file_path = os.path.join("data", "uploads", f"{document.id}_{document.filename}")
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        print(f"Error deleting file: {e}")
    
    # 3. Delete from Database
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}
