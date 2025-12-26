from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MessageBase(BaseModel):
    role: str
    content: str
    sources: Optional[str] = None

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    conversation_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    title: Optional[str] = "New Chat"

class ConversationCreate(ConversationBase):
    pass

class Conversation(ConversationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    # messages: List[Message] = [] # By default we might not want to load all messages for list view

    class Config:
        from_attributes = True

class ConversationDetail(Conversation):
    messages: List[Message] = []
