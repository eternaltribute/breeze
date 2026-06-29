from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/profile", tags=["preferences"])


class PreferencesUpdate(BaseModel):
    desired_role: Optional[str] = None
    desired_location: Optional[str] = None
    location_type: Optional[str] = None
    desired_salary: Optional[int] = None


@router.put("/preferences")
def update_preferences(
    payload: PreferencesUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.desired_role = payload.desired_role
    user.desired_location = payload.desired_location
    user.location_type = payload.location_type
    user.desired_salary = payload.desired_salary
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

@router.get("/preferences")
def get_preferences(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "desired_role": user.desired_role,
        "desired_location": user.desired_location,
        "location_type": user.location_type,
        "desired_salary": user.desired_salary,
    }