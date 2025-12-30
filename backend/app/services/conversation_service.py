from sqlalchemy.orm import Session
from app.models.conversation import Conversation, Message
from app.schemas.conversation import ConversationCreate, MessageCreate
from typing import List, Optional
import json

class ConversationService:
    def get_conversations(self, db: Session, skip: int = 0, limit: int = 100) -> List[Conversation]:
        return db.query(Conversation).order_by(Conversation.updated_at.desc()).offset(skip).limit(limit).all()

    def get_conversation(self, db: Session, conversation_id: str) -> Optional[Conversation]:
        return db.query(Conversation).filter(Conversation.id == conversation_id).first()

    def create_conversation(self, db: Session, conversation: ConversationCreate) -> Conversation:
        db_conversation = Conversation(title=conversation.title)
        db.add(db_conversation)
        db.commit()
        db.refresh(db_conversation)
        return db_conversation

    def delete_conversation(self, db: Session, conversation_id: str) -> bool:
        db_conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if db_conversation:
            db.delete(db_conversation)
            db.commit()
            return True
        return False
        
    def update_conversation_title(self, db: Session, conversation_id: str, title: str) -> Optional[Conversation]:
        db_conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if db_conversation:
            db_conversation.title = title
            db.commit()
            db.refresh(db_conversation)
        return db_conversation

    def add_message(self, db: Session, conversation_id: str, message: MessageCreate) -> Message:
        # Check if conversation exists, if not create one (optional logic, but here we assume it exists or handled by caller)
        # However, to be safe, if ID provided doesn't exist, we should probably fail or create.
        # For now assume conversation exists.
        
        # Ensure sources is string if it's not None
        sources_str = message.sources
        if isinstance(sources_str, list):
            sources_str = json.dumps(sources_str)

        db_message = Message(
            conversation_id=conversation_id,
            role=message.role,
            content=message.content,
            sources=sources_str
        )
        db.add(db_message)
        
        # Update conversation updated_at
        db_conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if db_conversation:
            # Auto-generate title if it's the first user message and title is "New Chat"
            if db_conversation.title == "New Chat" and message.role == "user":
                 # Use first 30 chars of content as title
                 new_title = message.content[:30] + "..." if len(message.content) > 30 else message.content
                 db_conversation.title = new_title
                 
            db_conversation.updated_at = datetime.utcnow() # This will be handled by onupdate but manual update is good too
        
        db.commit()
        db.refresh(db_message)
        return db_message
    
    def delete_message(self, db: Session, conversation_id: str, message_id: int) -> bool:
        db_message = db.query(Message).filter(Message.id == message_id, Message.conversation_id == conversation_id).first()
        if db_message:
            db.delete(db_message)
            db.commit()
            return True
        return False

    def get_messages(self, db: Session, conversation_id: str) -> List[Message]:
        return db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()

from datetime import datetime
