from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Field, Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import DocType, Document, Job, JobEvent, JobEventType, JobStage

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


# Quick fix: avoids N+1 GET .../resume/job/{id} and .../cover-letter/job/{id}
# calls per job on the Dashboard, most of which return 404 for jobs with
# no linked document. Adds has_resume/has_cover_letter directly to the
# job list response instead.
class JobWithDocumentFlags(Job):
    has_resume: bool = False
    has_cover_letter: bool = False


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


class CompanyResearchNotesUpdate(BaseModel):
    company_research_notes: str


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


@router.get("", response_model=List[JobWithDocumentFlags])
def get_jobs(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    jobs = db.exec(select(Job).where(Job.owner_id == user_id)).all()

    job_ids = [job.id for job in jobs]
    linked_docs = (
        db.exec(
            select(Document.job_id, Document.doc_type).where(
                Document.user_id == user_id, Document.job_id.in_(job_ids)
            )
        ).all()
        if job_ids
        else []
    )

    resume_job_ids = {jid for jid, dtype in linked_docs if dtype == DocType.RESUME}
    cover_letter_job_ids = {
        jid for jid, dtype in linked_docs if dtype == DocType.COVER_LETTER
    }

    return [
        JobWithDocumentFlags(
            **job.model_dump(),
            has_resume=job.id in resume_job_ids,
            has_cover_letter=job.id in cover_letter_job_ids,
        )
        for job in jobs
    ]


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


@router.get("/{job_id}", response_model=JobWithDocumentFlags)
def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # RULES : same has_resume/has_cover_letter flags as GET /jobs, avoids
    # JobDetail.jsx needing seperate resume/cover-letter lookups.
    user_id = current_user.get("sub")
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    linked_doc_types = db.exec(
        select(Document.doc_type).where(
            Document.user_id == user_id, Document.job_id == job_id
        )
    ).all()

    return JobWithDocumentFlags(
        **job.model_dump(),
        has_resume=DocType.RESUME in linked_doc_types,
        has_cover_letter=DocType.COVER_LETTER in linked_doc_types,
    )


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


# S3-012: Persist Company Research Notes to Job Record
# Rules: S3-BR-002 (ownership), S3-BR-003 (audit-friendly timestamps)
@router.get("/{job_id}/research-notes")
def get_research_notes(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.id,
        "company_research_notes": job.company_research_notes,
        "updated_at": job.updated_at,
    }


@router.put("/{job_id}/research-notes")
def save_research_notes(
    job_id: str,
    payload: CompanyResearchNotesUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.company_research_notes = payload.company_research_notes
    job.updated_at = datetime.utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)

    return {
        "job_id": job.id,
        "company_research_notes": job.company_research_notes,
        "updated_at": job.updated_at,
    }


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

    if payload.interview_round is not None:
        if new_stage != JobStage.INTERVIEW:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Interview round can only be updated "
                    "while job is in Interview stage"
                ),
            )
        if payload.interview_round < 1 or payload.interview_round > 5:
            raise HTTPException(
                status_code=400, detail="Interview round must be between 1 and 5"
            )
        if not payload.notes or not payload.notes.strip():
            raise HTTPException(
                status_code=400, detail="Interview round notes are required"
            )
        if (
            job.interview_round is not None
            and payload.interview_round <= job.interview_round
        ):
            raise HTTPException(
                status_code=400,
                detail="Interview rounds can only move forward",
            )

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

    if current_stage != new_stage:
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

    if payload.interview_round is not None:
        suffix = (
            "st"
            if payload.interview_round == 1
            else (
                "nd"
                if payload.interview_round == 2
                else "rd" if payload.interview_round == 3 else "th"
            )
        )

        round_label = f"Interview - {payload.interview_round}{suffix} Round"

        db.add(
            JobEvent(
                job_id=job_id,
                owner_id=user_id,
                event_type=JobEventType.INTERVIEW,
                interview_round=round_label,
                notes=payload.notes.strip(),
                created_at=datetime.utcnow(),
            )
        )

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
