import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class JobStage(str, Enum):
    INTERESTED = "interested"
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class JobEventType(str, Enum):
    STAGE_CHANGE = "stage_change"
    INTERVIEW = "interview"
    FOLLOW_UP = "follow_up"
    OUTCOME = "outcome"


class JobEvent(SQLModel, table=True):
    __tablename__ = "job_events"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    job_id: str = Field(foreign_key="jobs.id", nullable=False, index=True)
    owner_id: str = Field(nullable=False, index=True)

    event_type: JobEventType = Field(nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Stage change fields (S2-008/S2-009)
    from_stage: Optional[JobStage] = Field(default=None)
    to_stage: Optional[JobStage] = Field(default=None)
    was_override: bool = Field(default=False)

    # Interview fields (S2-011)
    interview_round: Optional[str] = Field(default=None)
    interview_datetime: Optional[datetime] = Field(default=None)

    # Follow-up fields (S2-012)
    follow_up_due_date: Optional[datetime] = Field(default=None)
    follow_up_completed: Optional[bool] = Field(default=None)

    # Shared across event types
    notes: Optional[str] = Field(default=None)


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    owner_id: str = Field(nullable=False, index=True)  # Clerk user_id — S1-BR-006

    # Required fields
    company: str = Field(nullable=False)
    title: str = Field(nullable=False)
    job_posting_body: str = Field(nullable=False)

    # Stage
    stage: JobStage = Field(default=JobStage.INTERESTED)

    # Optional fields
    location: Optional[str] = Field(default=None)
    job_url: Optional[str] = Field(default=None)
    salary_range: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LocationType(str, Enum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ON_SITE = "on_site"


class EmploymentType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(primary_key=True)  # Clerk user_id
    email: str = Field(nullable=False, unique=True)
    first_name: Optional[str] = Field(default=None)
    last_name: Optional[str] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    professional_summary: Optional[str] = Field(default=None)
    desired_role: Optional[str] = Field(default=None)
    location_type: Optional[LocationType] = Field(default=None)
    desired_location: Optional[str] = Field(default=None)
    employment_type: Optional[EmploymentType] = Field(default=None)
    desired_salary_min: Optional[int] = Field(default=None)
    desired_salary_max: Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Skill(SQLModel, table=True):
    __tablename__ = "skills"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str

class UserSkill(SQLModel, table=True):
    __tablename__ = "user_skills"
    user_id: int = Field(foreign_key="users.id", primary_key=True)
    skill_id: int = Field(foreign_key="skills.id", primary_key=True)
    proficiency: str
    order: int = 0