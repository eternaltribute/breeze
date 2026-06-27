from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Experience

router = APIRouter(prefix="/profile", tags=["experiences"])


class ExperienceItem(BaseModel):
    title: str
    company: str
    city: str
    state: str
    start_date: str
    end_date: str
    description: str
    order: int


class SaveExperiencesRequest(BaseModel):
    experiences: List[ExperienceItem]


@router.get("/experiences")
def get_experiences(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    rows = db.exec(
        select(Experience)
        .where(Experience.user_id == user_id)
        .order_by(Experience.order)
    ).all()
    return rows


@router.put("/experiences")
def save_experiences(
    payload: SaveExperiencesRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    existing = db.exec(
        select(Experience).where(Experience.user_id == user_id)
    ).all()
    for row in existing:
        db.delete(row)
    db.flush()

    for item in payload.experiences:
        db.add(Experience(
            user_id=user_id,
            title=item.title,
            company=item.company,
            city=item.city,
            state=item.state,
            start_date=item.start_date,
            end_date=item.end_date,
            description=item.description,
            order=item.order,
            updated_at=datetime.utcnow(),
        ))

    db.commit()
    return {"message": "Experiences saved"}