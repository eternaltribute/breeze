# S3-020: Expand Unit Test Coverage for Security and Ownership Rules
# Verifies that cross-user access is blocked everywhere: a user should
# never be able to read, modify, or delete another user's job or the
# job's related events/interviews/documents, even with a valid token.
# Rules: S3-BR-002

from contextlib import contextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_db
from main import app

OWNER_ID = "owner_user_1"
ATTACKER_ID = "attacker_user_2"


@pytest.fixture(name="db")
def db_fixture():
    """In-memory SQLite database, same pattern as test_jobs_workflow.py."""
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
    """TestClient authenticated as OWNER_ID."""

    def get_db_override():
        yield db

    def get_current_user_override():
        return {"sub": OWNER_ID, "email": "owner@example.com"}

    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        app.dependency_overrides[get_db] = get_db_override
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = get_current_user_override
        yield TestClient(app)
        app.dependency_overrides.clear()


@pytest.fixture(name="test_job")
def test_job_fixture(client: TestClient):
    """Job created by OWNER_ID."""
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


@contextmanager
def as_attacker():
    """Temporarily swap the authenticated user to ATTACKER_ID for the
    duration of the `with` block, then restore OWNER_ID.

    NOTE: this is purely a test-mocking mechanism, not a real auth flow.
    In production every request carries its own JWT and get_current_user
    decodes it independently per-request — there's no shared state
    between real users. This swap only exists because our test suite
    replaces real auth with app.dependency_overrides, which is one
    shared dict on the app object across the whole test process. This
    lets one TestClient simulate two different logged-in identities
    without them colliding."""
    from app.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: {
        "sub": ATTACKER_ID,
        "email": "attacker@example.com",
    }
    try:
        yield
    finally:
        app.dependency_overrides[get_current_user] = lambda: {
            "sub": OWNER_ID,
            "email": "owner@example.com",
        }


# --- Job ownership ---


def test_get_job_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.get(f"/jobs/{test_job['id']}")
    assert response.status_code == 404


def test_update_job_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.put(
            f"/jobs/{test_job['id']}", json={"company": "Hijacked Co"}
        )
    assert response.status_code == 404


def test_delete_job_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.delete(f"/jobs/{test_job['id']}")
    assert response.status_code == 404

    # Regression: the job must still exist for its real owner afterward
    response = client.get(f"/jobs/{test_job['id']}")
    assert response.status_code == 200


def test_stage_transition_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.patch(
            f"/jobs/{test_job['id']}/stage",
            json={"new_stage": "applied", "confirm_override": False},
        )
    assert response.status_code == 404


def test_archive_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.post(f"/jobs/{test_job['id']}/archive")
    assert response.status_code == 404


def test_restore_blocked_for_other_user(client, test_job):
    client.post(f"/jobs/{test_job['id']}/archive")
    with as_attacker():
        response = client.post(
            f"/jobs/{test_job['id']}/restore", json={"restore_to": "applied"}
        )
    assert response.status_code == 404


# --- Events / interviews / outcomes / follow-ups ---


def test_get_events_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.get(f"/jobs/{test_job['id']}/events")
    assert response.status_code == 404


def test_create_interview_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.post(
            f"/jobs/{test_job['id']}/interviews",
            json={
                "interview_round": "Technical Screen",
                "interview_datetime": "2026-07-01T14:00:00",
                "notes": "Should not be allowed",
            },
        )
    assert response.status_code == 404


def test_get_timeline_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.get(f"/jobs/{test_job['id']}/timeline")
    assert response.status_code == 404


def test_follow_up_update_blocked_for_other_user(client, test_job):
    create_response = client.post(
        f"/jobs/{test_job['id']}/follow-ups",
        json={"follow_up_due_date": "2026-08-01T09:00:00", "notes": "Check in"},
    )
    event_id = create_response.json()["id"]

    with as_attacker():
        response = client.patch(
            f"/jobs/{test_job['id']}/follow-ups/{event_id}",
            json={"follow_up_completed": True},
        )
    assert response.status_code == 404


def test_follow_up_delete_blocked_for_other_user(client, test_job):
    create_response = client.post(
        f"/jobs/{test_job['id']}/follow-ups",
        json={"follow_up_due_date": "2026-08-01T09:00:00", "notes": "Check in"},
    )
    event_id = create_response.json()["id"]

    with as_attacker():
        response = client.delete(f"/jobs/{test_job['id']}/follow-ups/{event_id}")
    assert response.status_code == 404

    # Regression: owner can still delete their own follow-up afterward
    response = client.delete(f"/jobs/{test_job['id']}/follow-ups/{event_id}")
    assert response.status_code == 204


# --- Documents (resume / cover letter) ---


def test_resume_blocked_for_other_user(client, test_job, db):
    from app.models import Resume

    db.add(
        Resume(
            user_id=OWNER_ID,
            job_id=test_job["id"],
            file_name="resume.pdf",
            resume_text="Owner's resume",
        )
    )
    db.commit()

    with as_attacker():
        response = client.get(f"/resume/job/{test_job['id']}")
    assert response.status_code == 404


def test_cover_letter_blocked_for_other_user(client, test_job, db):
    from app.models import CoverLetter

    db.add(
        CoverLetter(
            user_id=OWNER_ID,
            job_id=test_job["id"],
            cover_letter_text="Owner's cover letter",
        )
    )
    db.commit()

    with as_attacker():
        response = client.get(f"/cover-letter/job/{test_job['id']}")
    assert response.status_code == 404


# --- Outcomes / AI endpoints ---


def test_get_outcome_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.get(f"/jobs/{test_job['id']}/outcome")
    assert response.status_code == 404


def test_create_outcome_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.post(
            f"/jobs/{test_job['id']}/outcome", json={"notes": "Should not work"}
        )
    assert response.status_code == 404


def test_ai_resume_draft_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.post(f"/jobs/{test_job['id']}/ai/resume")
    assert response.status_code == 404


def test_ai_rewrite_blocked_for_other_user(client, test_job):
    with as_attacker():
        response = client.post(
            f"/jobs/{test_job['id']}/ai/rewrite", json={"draft": "Some draft content"}
        )
    assert response.status_code == 404
