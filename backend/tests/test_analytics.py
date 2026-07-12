# S3-014: Expand Dashboard Analytics (Velocity and Stage Conversion)
# Rules: S3-BR-013, S3-BR-014, S3-BR-015

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_db
from app.models import JobEvent, JobEventType, JobStage
from main import app

TEST_USER_ID = "test_user_123"


@pytest.fixture(name="db")
def db_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(db: Session):
    def get_db_override():
        yield db

    def get_current_user_override():
        return {"sub": TEST_USER_ID, "email": "test@example.com"}

    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        app.dependency_overrides[get_db] = get_db_override
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = get_current_user_override
        yield TestClient(app)
        app.dependency_overrides.clear()


@pytest.fixture(name="test_job")
def test_job_fixture(client: TestClient):
    response = client.post(
        "/jobs",
        json={
            "company": "Test Co",
            "title": "Engineer",
            "job_posting_body": "Test posting",
        },
    )
    assert response.status_code == 201
    return response.json()


def make_stage_change(db, job_id, from_stage, to_stage, created_at):
    event = JobEvent(
        job_id=job_id,
        owner_id=TEST_USER_ID,
        event_type=JobEventType.STAGE_CHANGE,
        from_stage=from_stage,
        to_stage=to_stage,
        created_at=created_at,
    )
    db.add(event)
    db.commit()
    return event


# --- Happy path ---


def test_analytics_no_events_returns_zeros(client):
    """Edge case: a brand-new user with no stage transitions yet."""
    response = client.get("/jobs/analytics")
    assert response.status_code == 200
    data = response.json()
    assert data["velocity"] == 0
    assert data["stage_conversion"] == 0.0
    assert data["applied_count"] == 0
    assert data["converted_count"] == 0


def test_velocity_counts_recent_interested_to_applied(client, db, test_job):
    """Happy path: transitions within the last 7 days count toward velocity."""
    now = datetime.utcnow()
    make_stage_change(
        db,
        test_job["id"],
        JobStage.INTERESTED,
        JobStage.APPLIED,
        now - timedelta(days=2),
    )

    response = client.get("/jobs/analytics")
    data = response.json()
    assert data["velocity"] == 1


def test_velocity_excludes_transitions_outside_window(client, db, test_job):
    """Edge case: a transition older than 7 days should not count."""
    now = datetime.utcnow()
    make_stage_change(
        db,
        test_job["id"],
        JobStage.INTERESTED,
        JobStage.APPLIED,
        now - timedelta(days=10),
    )

    response = client.get("/jobs/analytics")
    data = response.json()
    assert data["velocity"] == 0


def test_velocity_ignores_non_interested_to_applied_transitions(client, db, test_job):
    """Edge case: other transition types shouldn't inflate velocity."""
    now = datetime.utcnow()
    make_stage_change(
        db,
        test_job["id"],
        JobStage.APPLIED,
        JobStage.INTERVIEW,
        now - timedelta(days=1),
    )

    response = client.get("/jobs/analytics")
    data = response.json()
    assert data["velocity"] == 0


def test_stage_conversion_within_window_counts(client, db, test_job):
    """Happy path: Applied -> Interview within 14 days counts as converted."""
    now = datetime.utcnow()
    applied_at = now - timedelta(days=20)
    make_stage_change(
        db, test_job["id"], JobStage.INTERESTED, JobStage.APPLIED, applied_at
    )
    make_stage_change(
        db,
        test_job["id"],
        JobStage.APPLIED,
        JobStage.INTERVIEW,
        applied_at + timedelta(days=10),
    )

    response = client.get("/jobs/analytics")
    data = response.json()
    assert data["applied_count"] == 1
    assert data["converted_count"] == 1
    assert data["stage_conversion"] == 100.0


def test_stage_conversion_outside_window_does_not_count(client, db, test_job):
    """Edge case: Applied -> Interview after 14 days should not convert."""
    now = datetime.utcnow()
    applied_at = now - timedelta(days=30)
    make_stage_change(
        db, test_job["id"], JobStage.INTERESTED, JobStage.APPLIED, applied_at
    )
    make_stage_change(
        db,
        test_job["id"],
        JobStage.APPLIED,
        JobStage.INTERVIEW,
        applied_at + timedelta(days=20),
    )

    response = client.get("/jobs/analytics")
    data = response.json()
    assert data["applied_count"] == 1
    assert data["converted_count"] == 0
    assert data["stage_conversion"] == 0.0


def test_stage_conversion_mixed_jobs(client, db, test_job):
    """Regression: conversion rate is computed correctly across multiple jobs."""
    now = datetime.utcnow()

    # Job 1: converts within window
    applied_at_1 = now - timedelta(days=20)
    make_stage_change(
        db, test_job["id"], JobStage.INTERESTED, JobStage.APPLIED, applied_at_1
    )
    make_stage_change(
        db,
        test_job["id"],
        JobStage.APPLIED,
        JobStage.INTERVIEW,
        applied_at_1 + timedelta(days=5),
    )

    # Job 2: applied, never converts
    second_job = client.post(
        "/jobs",
        json={"company": "Other Co", "title": "PM", "job_posting_body": "Posting"},
    ).json()
    applied_at_2 = now - timedelta(days=15)
    make_stage_change(
        db, second_job["id"], JobStage.INTERESTED, JobStage.APPLIED, applied_at_2
    )

    response = client.get("/jobs/analytics")
    data = response.json()
    assert data["applied_count"] == 2
    assert data["converted_count"] == 1
    assert data["stage_conversion"] == 50.0


def test_analytics_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/jobs/analytics")
    assert response.status_code == 401
