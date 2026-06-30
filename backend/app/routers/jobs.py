from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Field, Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Job, JobEvent, JobEventType, JobStage

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
    interview_round: Optional[int] = Field(default=None)


class JobReminderCount(BaseModel):
    job_id: str
    active_count: int


@router.get("/reminders", response_model=List[JobReminderCount])
def get_job_reminder_counts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    follow_ups = db.exec(
        select(JobEvent).where(
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.FOLLOW_UP,
            JobEvent.follow_up_completed.is_(False),
        )
    ).all()

    counts = {}

    for event in follow_ups:
        counts[event.job_id] = counts.get(event.job_id, 0) + 1

    return [
        JobReminderCount(job_id=job_id, active_count=count)
        for job_id, count in counts.items()
    ]


@router.get("", response_model=List[Job])
def get_jobs(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    return db.exec(select(Job).where(Job.owner_id == user_id)).all()


@router.post("", response_model=Job, status_code=201)
def create_job(
    payload: JobCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = Job(owner_id=user_id, **payload.model_dump())
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
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()

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
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
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
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Delete linked job_events first to avoid foreign key violation
    events = db.exec(select(JobEvent).where(JobEvent.job_id == job_id)).all()
    for event in events:
        db.delete(event)

    db.delete(job)
    db.commit()
    return Response(status_code=204)


# S2-008: Pipeline Stage Transition Controls
# Validates stage transitions against allowed rules (S2-BR-005)
# Handles override flow with confirmation (S2-BR-007)
# Logs every transition to job_events (S2-BR-008)

ALLOWED_TRANSITIONS = {
    JobStage.INTERESTED: {JobStage.APPLIED, JobStage.REJECTED},
    JobStage.APPLIED: {JobStage.INTERVIEW, JobStage.REJECTED},
    JobStage.INTERVIEW: {JobStage.OFFER, JobStage.REJECTED},
    JobStage.OFFER: {JobStage.ARCHIVED, JobStage.REJECTED},
    JobStage.REJECTED: set(),
    JobStage.ARCHIVED: set(),
}


class StageTransitionRequest(BaseModel):
    new_stage: JobStage
    confirm_override: bool = False
    notes: str | None = None
    interview_round: Optional[int] = None


@router.patch("/{job_id}/stage", response_model=Job)
def transition_stage(
    job_id: str,
    payload: StageTransitionRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Transition a job to a new stage with validation and event logging."""
    user_id = current_user.get("sub")

    # Fetch job and verify ownership
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    current_stage = job.stage
    new_stage = payload.new_stage

    # No-op if same stage and no interview_round update
    if current_stage == new_stage and payload.interview_round is None:
        raise HTTPException(status_code=400, detail="Job is already in this stage")

    is_forward = new_stage in ALLOWED_TRANSITIONS.get(current_stage, set())

    # Non-forward transition requires explicit confirmation (S2-BR-007)
    if not is_forward and not payload.confirm_override:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"'{new_stage}' is not a standard forward transition "
                    f"from '{current_stage}'. Set confirm_override=true to proceed."
                ),
                "requires_confirmation": True,
                "from_stage": current_stage,
                "to_stage": new_stage,
            },
        )

    # Apply the stage change
    job.stage = new_stage
    job.updated_at = datetime.utcnow()
    if payload.interview_round is not None:
        job.interview_round = payload.interview_round
    db.add(job)

    # Log the transition to job_events (S2-BR-008/S2-009)
    event = JobEvent(
        job_id=job_id,
        owner_id=user_id,
        event_type=JobEventType.STAGE_CHANGE,
        from_stage=current_stage,
        to_stage=new_stage,
        was_override=not is_forward,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(job)
    return job


# S2-014: Job Archive and Restore Workflow
# Archive moves job to archived stage and logs the event
# Restore moves job from archived to a user-specified stage
# Rules: S2-BR-006, S2-BR-009


class RestoreRequest(BaseModel):
    restore_to: JobStage
    notes: str | None = None


@router.post("/{job_id}/archive", response_model=Job)
def archive_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Archive a job by moving it to the archived stage."""
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.stage == JobStage.ARCHIVED:
        raise HTTPException(status_code=400, detail="Job is already archived")

    previous_stage = job.stage
    job.stage = JobStage.ARCHIVED
    job.updated_at = datetime.utcnow()
    db.add(job)

    event = JobEvent(
        job_id=job_id,
        owner_id=user_id,
        event_type=JobEventType.STAGE_CHANGE,
        from_stage=previous_stage,
        to_stage=JobStage.ARCHIVED,
        was_override=False,
        notes="Job archived",
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/restore", response_model=Job)
def restore_job(
    job_id: str,
    payload: RestoreRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore a job from archived to a specified active stage."""
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.stage != JobStage.ARCHIVED:
        raise HTTPException(
            status_code=400,
            detail="Only archived jobs can be restored",
        )

    if payload.restore_to == JobStage.ARCHIVED:
        raise HTTPException(
            status_code=400,
            detail="Cannot restore a job to archived stage",
        )

    job.stage = payload.restore_to
    job.updated_at = datetime.utcnow()
    db.add(job)

    event = JobEvent(
        job_id=job_id,
        owner_id=user_id,
        event_type=JobEventType.STAGE_CHANGE,
        from_stage=JobStage.ARCHIVED,
        to_stage=payload.restore_to,
        was_override=True,
        notes=payload.notes or "Job restored from archive",
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(job)
    return job
