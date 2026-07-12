# S3-014: Expand Dashboard Analytics (Velocity and Stage Conversion)
# Computes metrics from persisted JobEvent history, not live job snapshots.
# Rules: S3-BR-013, S3-BR-014, S3-BR-015

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import JobEvent, JobEventType, JobStage

router = APIRouter(prefix="/jobs", tags=["analytics"])

VELOCITY_WINDOW_DAYS = 7
CONVERSION_WINDOW_DAYS = 14


class AnalyticsResponse(BaseModel):
    velocity: int
    velocity_window_days: int
    stage_conversion: float
    stage_conversion_window_days: int
    applied_count: int
    converted_count: int


@router.get("/analytics", response_model=AnalyticsResponse)
def get_dashboard_analytics(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compute velocity and stage conversion from persisted JobEvent
    history (S3-BR-015). Both metrics are backend-computed rather than
    derived from a job's current stage, since a job's current state
    alone can't tell us *when* a transition happened."""
    user_id = current_user.get("sub")
    now = datetime.utcnow()

    # S3-BR-013: velocity = Interested -> Applied transitions in a
    # rolling 7-day window.
    velocity_since = now - timedelta(days=VELOCITY_WINDOW_DAYS)
    velocity = db.exec(
        select(func.count(JobEvent.id)).where(
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.STAGE_CHANGE,
            JobEvent.from_stage == JobStage.INTERESTED,
            JobEvent.to_stage == JobStage.APPLIED,
            JobEvent.created_at >= velocity_since,
        )
    ).one()

    # S3-BR-014: stage conversion = Applied -> Interview conversion
    # within 14 days, using persisted timestamps.
    applied_events = db.exec(
        select(JobEvent).where(
            JobEvent.owner_id == user_id,
            JobEvent.event_type == JobEventType.STAGE_CHANGE,
            JobEvent.to_stage == JobStage.APPLIED,
        )
    ).all()

    converted_count = 0
    for applied_event in applied_events:
        window_end = applied_event.created_at + timedelta(days=CONVERSION_WINDOW_DAYS)
        interview_event = db.exec(
            select(JobEvent).where(
                JobEvent.owner_id == user_id,
                JobEvent.job_id == applied_event.job_id,
                JobEvent.event_type == JobEventType.STAGE_CHANGE,
                JobEvent.to_stage == JobStage.INTERVIEW,
                JobEvent.created_at > applied_event.created_at,
                JobEvent.created_at <= window_end,
            )
        ).first()
        if interview_event:
            converted_count += 1

    applied_count = len(applied_events)
    stage_conversion = (
        round((converted_count / applied_count) * 100, 1) if applied_count > 0 else 0.0
    )

    return AnalyticsResponse(
        velocity=velocity,
        velocity_window_days=VELOCITY_WINDOW_DAYS,
        stage_conversion=stage_conversion,
        stage_conversion_window_days=CONVERSION_WINDOW_DAYS,
        applied_count=applied_count,
        converted_count=converted_count,
    )
