from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Education

router = APIRouter(prefix="/profile", tags=["education"])


class EducationItem(BaseModel):
    school: str
    degree: str
    field_of_study: str
    start_date: date
    end_date: date
    order: int


class SaveEducationRequest(BaseModel):
    education: List[EducationItem]


@router.get("/education")
def get_education(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    rows = db.exec(
        select(Education).where(Education.user_id == user_id).order_by(Education.order)
    ).all()
    return rows


@router.put("/education")
def save_education(
    payload: SaveEducationRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    existing = db.exec(select(Education).where(Education.user_id == user_id)).all()
    for row in existing:
        db.delete(row)
    db.flush()

    for item in payload.education:
        db.add(
            Education(
                user_id=user_id,
                school=item.school,
                degree=item.degree,
                field_of_study=item.field_of_study,
                start_date=item.start_date,
                end_date=item.end_date,
                order=item.order,
                updated_at=datetime.utcnow(),
            )
        )

    db.commit()
    return {"message": "Education saved"}
