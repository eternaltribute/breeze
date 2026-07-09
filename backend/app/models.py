import enum
import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column
from sqlalchemy import String as SAString
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
    DOCUMENT = "document"


class JobEvent(SQLModel, table=True):
    __tablename__ = "job_events"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    job_id: str = Field(foreign_key="jobs.id", nullable=False, index=True)
    owner_id: str = Field(nullable=False, index=True)

    event_type: JobEventType = Field(nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    from_stage: Optional[JobStage] = Field(default=None)
    to_stage: Optional[JobStage] = Field(default=None)
    was_override: bool = Field(default=False)

    interview_round: Optional[str] = Field(default=None)
    interview_datetime: Optional[datetime] = Field(default=None)
    follow_up_due_date: Optional[datetime] = Field(default=None)
    follow_up_completed: Optional[bool] = Field(default=None)
    notes: Optional[str] = Field(default=None)


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    owner_id: str = Field(nullable=False, index=True)

    company: str = Field(nullable=False)
    title: str = Field(nullable=False)
    job_posting_body: str = Field(nullable=False)

    stage: JobStage = Field(default=JobStage.INTERESTED)

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
    profile_photo_path: Optional[str] = Field(default=None)
    desired_role: Optional[str] = Field(default=None)
    location_type: Optional[str] = Field(default=None)
    desired_location: Optional[str] = Field(default=None)
    employment_type: Optional[EmploymentType] = Field(
        default=None,sa_column=Column("employment_type",SAString,nullable=True)
    )
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


class DocType(str, Enum):
    RESUME = "resume"
    COVER_LETTER = "cover_letter"


class DocStatus(str, Enum):
    DRAFT = "draft"
    FINAL = "final"
    ARCHIVED = "archived"


class Document(SQLModel, table=True):
    __tablename__ = "documents"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", nullable=False, index=True)
    job_id: Optional[str] = Field(default=None, foreign_key="jobs.id")
    title: str
    doc_type: DocType = Field(sa_column=Column("doc_type", SAString, nullable=False))
    status: DocStatus = Field(
        default=DocStatus.DRAFT,sa_column=Column("status", SAString,nullable=False)
    )
    tags: Optional[str] = Field(default=None)  # comma-separated
    file_name: Optional[str] = Field(default=None)
    file_url: Optional[str] = Field(default=None)
    document_text: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    version_label: Optional[str] = Field(default=None)
    version_number: Optional[int] = Field(default=None)

class DocumentVersion(SQLModel, table=True):
    __tablename__ = "document_versions"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    document_id: str = Field(foreign_key="documents.id", nullable=False, index=True)
    user_id: str = Field(foreign_key="users.id", nullable=False, index=True)
    version_number: int = Field(nullable=False)
    version_label: Optional[str] = Field(default=None)
    document_text: Optional[str] = Field(default=None)
    file_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)