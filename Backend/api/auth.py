from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core.database import get_db, User
from core.auth import get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta
from adapters.comfy_client import comfy_adapter

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    is_paused: bool = False
    comfy_url: str
    needs_setup: bool = False

    class Config:
        from_attributes = True

class PreferencesUpdate(BaseModel):
    comfy_url: str

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        username=user_in.username,
        hashed_password=hashed_pw,
        email=user_in.email
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    # Sync adapter with current user's preferred URL if it's different
    if current_user.comfy_url and comfy_adapter.comfy_server != current_user.comfy_url:
        comfy_adapter.set_server_url(current_user.comfy_url)
    
    # Simple logic to determine if setup is needed
    # If it's still default, we might want to flag it for first-time setup
    # but the user said "logging in for first time, ask for these preferences"
    # We can add a flag or just check if it's the default value.
    res = UserResponse.from_orm(current_user)
    if current_user.comfy_url == "127.0.0.1:8188":
         # In a real app we might use a separate flag, but this works for now
         res.needs_setup = True
    return res

@router.patch("/preferences", response_model=UserResponse)
async def update_preferences(pref: PreferencesUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.comfy_url = pref.comfy_url
    db.commit()
    db.refresh(current_user)
    
    # Restart listener with new URL
    await comfy_adapter.restart_listener(pref.comfy_url)
    
    return current_user
