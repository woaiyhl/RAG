from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base
from datetime import datetime

class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    upload_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="processed") # processed, error
    file_size = Column(Integer, default=0)
