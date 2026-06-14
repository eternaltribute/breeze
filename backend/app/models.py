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