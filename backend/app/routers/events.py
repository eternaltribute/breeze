# S2-009: Persist Stage Transition Timestamps
# Endpoints for reading and writing job events (stage changes, interviews, follow-ups)
# Feeds S2-010 (timeline) and is written to by S2-008 (stage transitions)

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Job, JobEvent, JobEventType, JobStage

router = APIRouter(prefix="/jobs", tags=["events"])


class JobEventCreate(BaseModel):
    event_type: JobEventType
    from_stage: JobStage | None = None
    to_stage: JobStage | None = None
    was_override: bool = False
    notes: str | None = None


@router.get("/{job_id}/events", response_model=List[JobEvent])
def get_job_events(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all events for a job in chronological order."""
    user_id = current_user.get("sub")

    # Verify job exists and belongs to user
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return db.exec(
        select(JobEvent)
        .where(JobEvent.job_id == job_id, JobEvent.owner_id == user_id)
        .order_by(JobEvent.created_at)
    ).all()


@router.post("/{job_id}/events", response_model=JobEvent, status_code=201)
def create_job_event(
    job_id: str,
    payload: JobEventCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new event for a job (stage change, interview, follow-up, etc.)."""
    user_id = current_user.get("sub")

    # Verify job exists and belongs to user
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    event = JobEvent(
        job_id=job_id,
        owner_id=user_id,
        event_type=payload.event_type,
        from_stage=payload.from_stage,
        to_stage=payload.to_stage,
        was_override=payload.was_override,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
