from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Use SQLite for simplicity
DB_URL = "sqlite:///./ai_studio.db"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tasks = relationship("Task", back_populates="owner")
    batches = relationship("Batch", back_populates="owner")

class Batch(Base):
    __tablename__ = "batches"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    type = Column(String)
    status = Column(String)
    total_tasks = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="batches")
    tasks = relationship("Task", back_populates="batch")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    status = Column(String)
    type = Column(String)
    batch_id = Column(String, ForeignKey("batches.id"), nullable=True)
    positive_prompt = Column(Text)
    negative_prompt = Column(Text, nullable=True)
    seed = Column(Integer, nullable=True)
    width = Column(Integer)
    height = Column(Integer)
    steps = Column(Integer, nullable=True)
    cfg = Column(Float, nullable=True)
    sampler_name = Column(String, nullable=True)
    scheduler = Column(String, nullable=True)
    denoise = Column(Float, nullable=True)
    workflow = Column(String, nullable=True)
    comfy_prompt_id = Column(String, nullable=True)
    images_json = Column(Text, nullable=True)  # Store images as JSON string
    error = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="tasks")
    batch = relationship("Batch", back_populates="tasks")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
