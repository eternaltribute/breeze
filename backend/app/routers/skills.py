from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Skill, User, UserSkill

router = APIRouter(prefix="/profile", tags=["skills"])
# hopefully this works


class SkillItem(BaseModel):
    name: str
    proficiency: str
    order: int


class SaveSkillsRequest(BaseModel):
    skills: List[SkillItem]


@router.get("/skills")
def get_user_skills(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if not user:
        return []

    rows = db.exec(
        select(UserSkill, Skill)
        .join(Skill, UserSkill.skill_id == Skill.id)
        .where(UserSkill.user_id == user.id)
        .order_by(UserSkill.order)
    ).all()

    return [
        {
            "id": us.skill_id,
            "name": skill.name,
            "proficiency": us.proficiency,
            "order": us.order,
        }
        for us, skill in rows
    ]


@router.put("/skills")
def save_user_skills(
    payload: SaveSkillsRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete all existing user skills, then re-insert
    existing = db.exec(select(UserSkill).where(UserSkill.user_id == user.id)).all()
    for row in existing:
        db.delete(row)
    db.flush()

    for item in payload.skills:
        skill = db.exec(select(Skill).where(Skill.name == item.name)).first()
        if not skill:
            raise HTTPException(status_code=400, detail=f"Unknown skill: '{item.name}'")
        db.add(
            UserSkill(
                user_id=user.id,
                skill_id=skill.id,
                proficiency=item.proficiency,
                order=item.order,
            )
        )

    db.commit()
    return {"message": "Skills saved"}
