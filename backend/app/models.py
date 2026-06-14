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

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(primary_key=True)
    email: str = Field(unique=True)
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    professional_summary: Optional[str] = None
    desired_role: Optional[str] = None
    desired_location: Optional[str] = None
    desired_salary_min: Optional[int] = None
    desired_salary_max: Optional[int] = None
    open_to_relocation: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
