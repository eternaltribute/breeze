# S2-009: Persist Stage Transition Timestamps
# Endpoints for reading and writing job events (stage changes, interviews, follow-ups)
# Feeds S2-010 (timeline) and is written to by S2-008 (stage transitions)

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
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
        title = "Follow-up reminder scheduled"
        detail = event.notes or "Reminder scheduled"
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


# S2-013: Outcome Tracking Controls
# Endpoints for recording and retrieving job outcomes
# Rules: S2-BR-004, S2-BR-005
# Outcomes can only be recorded when job is in a terminal stage


OUTCOME_ALLOWED_STAGES = {JobStage.OFFER, JobStage.REJECTED, JobStage.ARCHIVED}


class OutcomeCreate(BaseModel):
    notes: str


@router.post("/{job_id}/outcome", response_model=JobEvent, status_code=201)
def create_outcome(
    job_id: str,
    payload: OutcomeCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a final outcome for a job.

    Only allowed when job is in Offer, Rejected, or Archived stage.
    """
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.stage not in OUTCOME_ALLOWED_STAGES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Outcomes can only be recorded for jobs in "
                f"Offer, Rejected, or Archived stage. "
                f"Current stage: {job.stage.value}"
            ),
        )

    event = JobEvent(
        job_id=job_id,
        owner_id=user_id,
        event_type=JobEventType.OUTCOME,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{job_id}/outcome", response_model=List[JobEvent])
def get_outcomes(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all outcome records for a job."""
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return db.exec(
        select(JobEvent)
        .where(
            JobEvent.job_id == job_id,
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.OUTCOME,
        )
        .order_by(JobEvent.created_at)
    ).all()


# S2-012 - Implement Follow-Up and Reminder Tracking
# Rules: S2-BR-012, S2-BR-013
# Outcome: Users can create and manage follow-up tasks/reminders tied to a job


class FollowUpCreate(BaseModel):
    follow_up_due_date: datetime
    notes: str | None = None


class FollowUpUpdate(BaseModel):
    follow_up_completed: bool | None = None
    notes: str | None = None
    follow_up_due_date: datetime | None = None


@router.post("/{job_id}/follow-ups", response_model=JobEvent, status_code=201)
def create_follow_up(
    job_id: str,
    payload: FollowUpCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    event = JobEvent(
        job_id=job_id,
        owner_id=user_id,
        event_type=JobEventType.FOLLOW_UP,
        follow_up_due_date=payload.follow_up_due_date,
        follow_up_completed=False,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{job_id}/follow-ups", response_model=List[JobEvent])
def get_follow_ups(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return db.exec(
        select(JobEvent)
        .where(
            JobEvent.job_id == job_id,
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.FOLLOW_UP,
        )
        .order_by(JobEvent.follow_up_due_date)
    ).all()


@router.patch("/{job_id}/follow-ups/{event_id}", response_model=JobEvent)
def update_follow_up(
    job_id: str,
    event_id: str,
    payload: FollowUpUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    event = db.exec(
        select(JobEvent).where(
            JobEvent.id == event_id,
            JobEvent.job_id == job_id,
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.FOLLOW_UP,
        )
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    if payload.follow_up_completed is not None:
        event.follow_up_completed = payload.follow_up_completed
    if payload.notes is not None:
        event.notes = payload.notes
    if payload.follow_up_due_date is not None:
        event.follow_up_due_date = payload.follow_up_due_date

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{job_id}/follow-ups/{event_id}", status_code=204)
def delete_follow_up(
    job_id: str,
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    event = db.exec(
        select(JobEvent).where(
            JobEvent.id == event_id,
            JobEvent.job_id == job_id,
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.FOLLOW_UP,
        )
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    db.delete(event)
    db.commit()

    return Response(status_code=204)
