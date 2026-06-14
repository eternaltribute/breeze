from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


# S1-015: Per-User Data Authorization
# All job records are filtered by the authenticated user's Clerk user_id
# (owner_id), derived from the verified JWT — never from client input.
# Cross-user access is denied per S1-BR-006, S1-BR-007, S1-BR-008.
@router.get("/")
def get_jobs(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    jobs = db.exec(select(Job).where(Job.owner_id == user_id)).all()
    return jobs


@router.get("/{job_id}")
def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job
