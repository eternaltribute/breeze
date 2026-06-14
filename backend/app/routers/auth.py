from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime

from typing import Optional
from app.dependencies import get_current_user
from app.database import get_db
from app.models import User
from pydantic import BaseModel

class UserSyncPayload(BaseModel):
    email: str
    first_name: str
    last_name: str

router = APIRouter(prefix="/auth", tags=["auth"])

class UserProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone_number: Optional[str] = None
    professional_summary: Optional[str] = None

@router.post("/sync")
def sync_user(payload: UserSyncPayload, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db),):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)

    if user is None:
        user = User(
            id=user_id,
            email=payload.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        db.add(user)
    else:
        user.email = payload.email
        user.first_name = payload.first_name
        user.last_name = payload.last_name
        user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)
    return {"user_id": user.id, "email": user.email}

# S1-010: User Self-Registration (sync)
# On first authenticated request, create a users row if one doesn't exist
# for this Clerk user_id. Subsequent requests just return the existing record.
@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    email = current_user.get("email")

    user = db.exec(select(User).where(User.id == user_id)).first()

    if not user:
        user = User(id=user_id, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "user_id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    return {
        "message": "Logged out successfully",
        "user_id": current_user.get("sub"),
    }

@router.get("/profile")
def get_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/profile")
def update_profile(
    payload: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        user = User(
            id=user_id,
            email=payload.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        db.add(user)
    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.email = payload.email
    user.phone_number = payload.phone_number
    user.professional_summary = payload.professional_summary
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user