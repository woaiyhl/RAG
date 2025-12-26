from fastapi import APIRouter
from app.api.endpoints import rag, documents, conversations

api_router = APIRouter()
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])

