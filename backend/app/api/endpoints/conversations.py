from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.services.conversation_service import ConversationService
from app.schemas.conversation import Conversation, ConversationCreate, ConversationDetail, MessageCreate
from app.services.rag_engine import RAGEngine
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from typing import List
import json
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
conversation_service = ConversationService()

class ChatRequest(BaseModel):
    query: str

@router.get("/", response_model=List[Conversation])
def read_conversations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return conversation_service.get_conversations(db, skip=skip, limit=limit)

@router.post("/", response_model=Conversation)
def create_conversation(
    conversation: ConversationCreate,
    db: Session = Depends(get_db)
):
    return conversation_service.create_conversation(db, conversation)

@router.get("/{conversation_id}", response_model=ConversationDetail)
def read_conversation(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    db_conversation = conversation_service.get_conversation(db, conversation_id)
    if db_conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Ensure messages are loaded
    messages = conversation_service.get_messages(db, conversation_id)
    db_conversation.messages = messages
    return db_conversation

@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    success = conversation_service.delete_conversation(db, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}

@router.delete("/{conversation_id}/messages/{message_id}")
def delete_message(
    conversation_id: str,
    message_id: int,
    db: Session = Depends(get_db)
):
    success = conversation_service.delete_message(db, conversation_id, message_id)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True}

@router.post("/{conversation_id}/chat")
async def chat_stream(
    conversation_id: str,
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    # 1. Check conversation exists
    conversation = conversation_service.get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 2. Save User Message
    user_msg = MessageCreate(role="user", content=request.query)
    db_user_msg = conversation_service.add_message(db, conversation_id, user_msg)
    user_msg_id = db_user_msg.id

    # 3. Get Chat History for RAG context
    # Fetch all previous messages (excluding the one we just added)
    db_messages = conversation_service.get_messages(db, conversation_id)
    # Convert to list of dicts
    chat_history = []
    # We want messages BEFORE the current query.
    # Since we just added the user message, it should be the last one (or close to last).
    # We can just iterate and exclude the current one by ID, or just take all except the last one.
    # Assuming get_messages returns ordered list.
    for msg in db_messages:
        if msg.id != user_msg_id:
            chat_history.append({"role": msg.role, "content": msg.content})

    # 4. Stream Response
    rag_engine = RAGEngine()
    
    async def generate():
        full_answer = ""
        sources = []
        is_saved = False
        
        try:
            async for chunk in rag_engine.astream_answer_generator(request.query, chat_history=chat_history):
                # Accumulate answer
                if "answer" in chunk:
                    full_answer += chunk["answer"]
                if "sources" in chunk:
                    sources = chunk["sources"]
                
                yield f"data: {json.dumps(chunk)}\n\n"
            
            # 4. Save Assistant Message after stream completes
            with SessionLocal() as session:
                service = ConversationService()
                assistant_msg = MessageCreate(
                    role="assistant", 
                    content=full_answer,
                    sources=json.dumps(sources) if sources else None
                )
                saved_msg = service.add_message(session, conversation_id, assistant_msg)
                is_saved = True
                
                # Send final IDs
                yield f"data: {json.dumps({'message_id': saved_msg.id, 'user_message_id': user_msg_id})}\n\n"
                
        except Exception as e:
            logger.error(f"Error in chat stream: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # If not saved (e.g. aborted or error) and we have some content, save it
            if not is_saved and full_answer:
                try:
                    logger.info("Saving partial message due to stream interruption")
                    with SessionLocal() as session:
                        service = ConversationService()
                        assistant_msg = MessageCreate(
                            role="assistant", 
                            content=full_answer,
                            sources=json.dumps(sources) if sources else None
                        )
                        service.add_message(session, conversation_id, assistant_msg)
                except Exception as save_error:
                    logger.error(f"Failed to save partial message: {str(save_error)}")

    return StreamingResponse(
            generate(), 
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable buffering for Nginx/Proxies
            }
          )
