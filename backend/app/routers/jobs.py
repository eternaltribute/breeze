from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Job, JobStage

router = APIRouter(prefix="/jobs", tags=["jobs"])

class JobCreate(BaseModel):
    company: str
    title: str
    job_posting_body: str
    stage: JobStage = JobStage.INTERESTED
    location: Optional[str] = None
    job_url: Optional[str] = None
    salary_range: Optional[str] = None
    notes: Optional[str] = None


class JobUpdate(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    job_posting_body: Optional[str] = None
    stage: Optional[JobStage] = None
    location: Optional[str] = None
    job_url: Optional[str] = None
    salary_range: Optional[str] = None
    notes: Optional[str] = None

@router.get("", response_model=List[Job])
def get_jobs(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    return db.exec(select(Job).where(Job.user_id == user_id)).all()


@router.post("", response_model=Job, status_code=201)
def create_job(
    payload: JobCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = Job(user_id=user_id, **payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=Job)
def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = db.exec(select(Job).where(Job.id == job_id, Job.user_id == user_id)).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.put("/{job_id}", response_model=Job)
def update_job(
    job_id: str,
    payload: JobUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = db.exec(select(Job).where(Job.id == job_id, Job.user_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    job.updated_at = datetime.utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = db.exec(select(Job).where(Job.id == job_id, Job.user_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return Response(status_code=204)