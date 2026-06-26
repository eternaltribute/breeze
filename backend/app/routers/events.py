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


# S2-011: Interview Tracking
# Endpoints for creating, reading, and editing interview events
# Rules: S2-BR-010 (multiple interviews per job)
# S2-BR-011 (round type, datetime, notes required)


class InterviewCreate(BaseModel):
    interview_round: str
    interview_datetime: datetime
    notes: str


class InterviewUpdate(BaseModel):
    interview_round: str | None = None
    interview_datetime: datetime | None = None
    notes: str | None = None


@router.post("/{job_id}/interviews", response_model=JobEvent, status_code=201)
def create_interview(
    job_id: str,
    payload: InterviewCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an interview event for a job.
    Requires round type, datetime, and notes (S2-BR-011)."""
    user_id = current_user.get("sub")

    # Verify job exists and belongs to user
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    event = JobEvent(
        job_id=job_id,
        owner_id=user_id,
        event_type=JobEventType.INTERVIEW,
        interview_round=payload.interview_round,
        interview_datetime=payload.interview_datetime,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{job_id}/interviews", response_model=List[JobEvent])
def get_interviews(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all interview events for a job in chronological order."""
    user_id = current_user.get("sub")

    # Verify job exists and belongs to user
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return db.exec(
        select(JobEvent)
        .where(
            JobEvent.job_id == job_id,
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.INTERVIEW,
        )
        .order_by(JobEvent.created_at)
    ).all()


@router.patch("/{job_id}/interviews/{event_id}", response_model=JobEvent)
def update_interview(
    job_id: str,
    event_id: str,
    payload: InterviewUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit an existing interview event."""
    user_id = current_user.get("sub")

    # Verify job exists and belongs to user
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Fetch the interview event
    event = db.exec(
        select(JobEvent).where(
            JobEvent.id == event_id,
            JobEvent.job_id == job_id,
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.INTERVIEW,
        )
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Interview event not found")

    # Apply updates
    if payload.interview_round is not None:
        event.interview_round = payload.interview_round
    if payload.interview_datetime is not None:
        event.interview_datetime = payload.interview_datetime
    if payload.notes is not None:
        event.notes = payload.notes

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# S2-010: Job Activity Timeline
# Returns formatted timeline of all events for frontend rendering
# Rules: S2-BR-009, S2-BR-013


class TimelineItem(BaseModel):
    id: str
    event_type: str
    timestamp: datetime
    title: str
    detail: str | None = None
    was_override: bool = False
    interview_datetime: datetime | None = None


def format_timeline_item(event: JobEvent) -> TimelineItem:
    """Format a raw JobEvent into a timeline-friendly shape."""
    if event.event_type == JobEventType.STAGE_CHANGE:
        title = f"Stage changed to {event.to_stage.value.capitalize()}"
        detail = (
            f"Moved from {event.from_stage.value.capitalize()}"
            if event.from_stage
            else None
        )
    elif event.event_type == JobEventType.INTERVIEW:
        title = event.interview_round or "Interview"
        detail = event.notes
    elif event.event_type == JobEventType.FOLLOW_UP:
        title = "Follow-up"
        detail = event.notes
    elif event.event_type == JobEventType.OUTCOME:
        title = "Outcome recorded"
        detail = event.notes
    else:
        title = event.event_type.value.replace("_", " ").capitalize()
        detail = event.notes

    return TimelineItem(
        id=event.id,
        event_type=event.event_type.value,
        timestamp=event.created_at,
        title=title,
        detail=detail,
        was_override=event.was_override,
        interview_datetime=event.interview_datetime,
    )


@router.get("/{job_id}/timeline", response_model=List[TimelineItem])
def get_job_timeline(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a formatted activity timeline for a job in chronological order."""
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    events = db.exec(
        select(JobEvent)
        .where(JobEvent.job_id == job_id, JobEvent.owner_id == user_id)
        .order_by(JobEvent.created_at)
    ).all()

    return [format_timeline_item(event) for event in events]
