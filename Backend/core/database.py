from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timezone
import os

# Use environment variable for database path if provided (useful for Electron production)
db_path = os.environ.get("DATABASE_PATH", "./ai_studio.db")
# Ensure the directory exists if it's an absolute path
if os.path.isabs(db_path) and os.path.dirname(db_path):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

DB_URL = f"sqlite:///{db_path}"

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
    is_paused = Column(Boolean, default=False)
    comfy_url = Column(String, default="127.0.0.1:8188")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tasks = relationship("Task", back_populates="owner")
    batches = relationship("Batch", back_populates="owner")
    prompt_collections = relationship("PromptCollection", back_populates="owner")
    saved_prompts = relationship("SavedPrompt", back_populates="owner")
    image_collections = relationship("ImageCollection", back_populates="owner")
    saved_images = relationship("SavedImage", back_populates="owner")

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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="tasks")
    batch = relationship("Batch", back_populates="tasks")

class PromptCollection(Base):
    __tablename__ = "prompt_collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="prompt_collections")
    prompts = relationship("SavedPrompt", back_populates="collection", cascade="all, delete-orphan")

class SavedPrompt(Base):
    __tablename__ = "saved_prompts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    positive_prompt = Column(Text)
    negative_prompt = Column(Text, nullable=True)
    steps = Column(Integer, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    is_liked = Column(Boolean, default=False)
    collection_id = Column(Integer, ForeignKey("prompt_collections.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="saved_prompts")
    collection = relationship("PromptCollection", back_populates="prompts")

class ImageCollection(Base):
    __tablename__ = "image_collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="image_collections")
    images = relationship("SavedImage", back_populates="collection", cascade="all, delete-orphan")

class SavedImage(Base):
    __tablename__ = "saved_images"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("image_collections.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    subfolder = Column(String, nullable=True)
    type = Column(String, default="collection")
    positive_prompt = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    steps = Column(Integer, nullable=True)
    seed = Column(Integer, nullable=True)
    workflow = Column(String, nullable=True)
    is_liked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="saved_images")
    collection = relationship("ImageCollection", back_populates="images")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
