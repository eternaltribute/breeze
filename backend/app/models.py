import enum
import uuid
from datetime import date, datetime
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
    interview_round: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LocationType(str, enum.Enum):
    REMOTE = "Remote"
    HYBRID = "Hybrid"
    ON_SITE = "On-site"


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
    location_type: Optional[str] = Field(default=None)
    desired_location: Optional[str] = Field(default=None)
    employment_type: Optional[EmploymentType] = Field(default=None)
    desired_salary: Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Experience(SQLModel, table=True):
    __tablename__ = "experiences"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", nullable=False, index=True)
    title: str
    company: str
    city: str
    state: str
    start_date: date
    end_date: date
    description: str
    order: int = 0
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


class Education(SQLModel, table=True):
    __tablename__ = "education"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", nullable=False, index=True)
    school: str
    degree: str
    field_of_study: str
    start_date: date
    end_date: date
    order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Resume(SQLModel, table=True):
    __tablename__ = "resumes"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", nullable=False, index=True)
    job_id: Optional[str] = Field(default=None, foreign_key="jobs.id")
    file_name: Optional[str] = Field(default=None)
    file_url: Optional[str] = Field(default=None)
    resume_text: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CoverLetter(SQLModel, table=True):
    __tablename__ = "cover_letters"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", nullable=False, index=True)
    job_id: str = Field(foreign_key="jobs.id", nullable=False, index=True)
    cover_letter_text: str
    file_name: Optional[str] = Field(default=None)
    file_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
