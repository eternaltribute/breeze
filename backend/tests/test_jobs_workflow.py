# S2-008: Pipeline Stage Transition Controls
# S2-009: Persist Stage Transition Timestamps
# S2-011: Interview Tracking
# Tests for stage transition validation, event logging, and interview CRUD

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_db
from app.models import JobStage
from main import app

# --- Test Database Setup ---


@pytest.fixture(name="db")
def db_fixture():
    """Create an in-memory SQLite database for testing."""
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
    """Create a test client with mocked auth and in-memory database."""

    def get_db_override():
        yield db

    def get_current_user_override():
        return {"sub": "test_user_123", "email": "test@example.com"}

    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        app.dependency_overrides[get_db] = get_db_override
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = get_current_user_override
        yield TestClient(app)
        app.dependency_overrides.clear()


@pytest.fixture(name="test_job")
def test_job_fixture(client: TestClient):
    """Create a test job and return it."""
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


# --- S2-008: Stage Transition Tests ---


def test_valid_forward_transition(client, test_job):
    """Happy path: interested -> applied is a valid forward transition."""
    response = client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "applied", "confirm_override": False},
    )
    assert response.status_code == 200
    assert response.json()["stage"] == "applied"


def test_invalid_transition_without_confirmation(client, test_job):
    """Non-forward transition without confirm_override should return 409."""
    response = client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "offer", "confirm_override": False},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["requires_confirmation"] is True


def test_invalid_transition_with_confirmation(client, test_job):
    """Non-forward transition with confirm_override=True should succeed."""
    response = client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "offer", "confirm_override": True},
    )
    assert response.status_code == 200
    assert response.json()["stage"] == "offer"


def test_same_stage_transition(client, test_job):
    """Transitioning to the same stage should return 400."""
    response = client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "interested", "confirm_override": False},
    )
    assert response.status_code == 400


def test_stage_transition_no_token():
    """Unauthenticated stage transition should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.patch(
            "/jobs/fake-id/stage",
            json={"new_stage": "applied", "confirm_override": False},
        )
    assert response.status_code == 401


# --- S2-009: Event Logging Tests ---


def test_stage_change_logged_to_events(client, test_job, db):
    """Stage transition should create a corresponding job event."""
    from sqlmodel import select

    from app.models import JobEvent, JobEventType

    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "applied", "confirm_override": False},
    )

    events = db.exec(
        select(JobEvent).where(
            JobEvent.job_id == test_job["id"],
            JobEvent.event_type == JobEventType.STAGE_CHANGE,
        )
    ).all()
    assert len(events) == 1
    assert events[0].from_stage == JobStage.INTERESTED
    assert events[0].to_stage == JobStage.APPLIED
    assert events[0].was_override is False


def test_override_transition_logged_with_flag(client, test_job, db):
    """Override transition should be logged with was_override=True."""
    from sqlmodel import select

    from app.models import JobEvent, JobEventType

    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "offer", "confirm_override": True},
    )

    events = db.exec(
        select(JobEvent).where(
            JobEvent.job_id == test_job["id"],
            JobEvent.event_type == JobEventType.STAGE_CHANGE,
        )
    ).all()
    assert len(events) == 1
    assert events[0].was_override is True


def test_get_job_events(client, test_job):
    """GET /jobs/{job_id}/events should return all events for a job."""
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "applied", "confirm_override": False},
    )
    response = client.get(f"/jobs/{test_job['id']}/events")
    assert response.status_code == 200
    assert len(response.json()) == 1


# --- S2-011: Interview Tracking Tests ---


def test_create_interview(client, test_job):
    """Happy path: create an interview event with all required fields."""
    response = client.post(
        f"/jobs/{test_job['id']}/interviews",
        json={
            "interview_round": "Technical Screen",
            "interview_datetime": "2026-07-01T14:00:00",
            "notes": "Focus on system design",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["event_type"] == "interview"
    assert data["interview_round"] == "Technical Screen"
    assert data["notes"] == "Focus on system design"


def test_create_multiple_interviews(client, test_job):
    """A job can have multiple interview entries (S2-BR-010)."""
    for round_name in ["Phone Screen", "Technical", "Final"]:
        response = client.post(
            f"/jobs/{test_job['id']}/interviews",
            json={
                "interview_round": round_name,
                "interview_datetime": "2026-07-01T14:00:00",
                "notes": "Notes here",
            },
        )
        assert response.status_code == 201

    response = client.get(f"/jobs/{test_job['id']}/interviews")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_update_interview(client, test_job):
    """PATCH should update interview fields correctly."""
    create_response = client.post(
        f"/jobs/{test_job['id']}/interviews",
        json={
            "interview_round": "Phone Screen",
            "interview_datetime": "2026-07-01T14:00:00",
            "notes": "Original notes",
        },
    )
    event_id = create_response.json()["id"]

    update_response = client.patch(
        f"/jobs/{test_job['id']}/interviews/{event_id}",
        json={"notes": "Updated notes"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["notes"] == "Updated notes"


def test_create_interview_no_token():
    """Unauthenticated interview creation should return 401."""
    response = TestClient(app).post(
        "/jobs/fake-id/interviews",
        json={
            "interview_round": "Phone Screen",
            "interview_datetime": "2026-07-01T14:00:00",
            "notes": "Notes",
        },
    )
    assert response.status_code == 401


# --- S2-010: Activity Timeline Tests ---


def test_get_timeline_returns_formatted_items(client, test_job):
    """Timeline should return formatted items not raw JobEvent objects."""
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "applied", "confirm_override": False},
    )
    response = client.get(f"/jobs/{test_job['id']}/timeline")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    item = data[0]
    assert item["event_type"] == "stage_change"
    assert item["title"] == "Stage changed to Applied"
    assert item["detail"] == "Moved from Interested"
    assert item["was_override"] is False
    assert "timestamp" in item


def test_timeline_override_shows_flag(client, test_job):
    """Override transitions should show was_override=True in timeline."""
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "offer", "confirm_override": True},
    )
    response = client.get(f"/jobs/{test_job['id']}/timeline")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["was_override"] is True


def test_timeline_includes_interviews(client, test_job):
    """Timeline should include interview events with correct title and detail."""
    client.post(
        f"/jobs/{test_job['id']}/interviews",
        json={
            "interview_round": "Technical Screen",
            "interview_datetime": "2026-07-01T14:00:00",
            "notes": "Focus on system design",
        },
    )
    response = client.get(f"/jobs/{test_job['id']}/timeline")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["event_type"] == "interview"
    assert data[0]["title"] == "Technical Screen"
    assert data[0]["detail"] == "Focus on system design"


def test_timeline_chronological_order(client, test_job):
    """Timeline should return events in chronological order."""
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "applied", "confirm_override": False},
    )
    client.post(
        f"/jobs/{test_job['id']}/interviews",
        json={
            "interview_round": "Phone Screen",
            "interview_datetime": "2026-07-01T14:00:00",
            "notes": "Initial screen",
        },
    )
    response = client.get(f"/jobs/{test_job['id']}/timeline")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["event_type"] == "stage_change"
    assert data[1]["event_type"] == "interview"


def test_timeline_empty_for_new_job(client, test_job):
    """A brand new job with no events should return an empty timeline."""
    response = client.get(f"/jobs/{test_job['id']}/timeline")
    assert response.status_code == 200
    assert response.json() == []


def test_timeline_no_token():
    """Unauthenticated timeline request should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/jobs/fake-id/timeline")
    assert response.status_code == 401


# --- S2-013: Outcome Tracking Tests ---


def test_create_outcome_in_valid_stage(client, test_job):
    """Happy path: outcome can be recorded when job is in offer stage."""
    # Move job to offer stage first
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "offer", "confirm_override": True},
    )
    response = client.post(
        f"/jobs/{test_job['id']}/outcome",
        json={"notes": "Offer accepted, starting August 1"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["event_type"] == "outcome"
    assert data["notes"] == "Offer accepted, starting August 1"


def test_create_outcome_in_invalid_stage(client, test_job):
    """Outcome cannot be recorded when job is in a non-terminal stage."""
    response = client.post(
        f"/jobs/{test_job['id']}/outcome",
        json={"notes": "Should not work"},
    )
    assert response.status_code == 400


def test_create_outcome_in_rejected_stage(client, test_job):
    """Outcome can be recorded when job is in rejected stage."""
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "rejected", "confirm_override": False},
    )
    response = client.post(
        f"/jobs/{test_job['id']}/outcome",
        json={"notes": "Rejected after final round"},
    )
    assert response.status_code == 201
    assert response.json()["event_type"] == "outcome"


def test_get_outcomes(client, test_job):
    """GET /jobs/{job_id}/outcome should return all outcome records."""
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "rejected", "confirm_override": False},
    )
    client.post(
        f"/jobs/{test_job['id']}/outcome",
        json={"notes": "Rejected after final round"},
    )
    response = client.get(f"/jobs/{test_job['id']}/outcome")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_outcome_appears_in_timeline(client, test_job):
    """Outcome events should appear in the activity timeline."""
    client.patch(
        f"/jobs/{test_job['id']}/stage",
        json={"new_stage": "rejected", "confirm_override": False},
    )
    client.post(
        f"/jobs/{test_job['id']}/outcome",
        json={"notes": "Rejected after final round"},
    )
    response = client.get(f"/jobs/{test_job['id']}/timeline")
    assert response.status_code == 200
    data = response.json()
    outcome_items = [i for i in data if i["event_type"] == "outcome"]
    assert len(outcome_items) == 1
    assert outcome_items[0]["title"] == "Outcome recorded"
    assert outcome_items[0]["detail"] == "Rejected after final round"


def test_create_outcome_no_token():
    """Unauthenticated outcome creation should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post(
            "/jobs/fake-id/outcome",
            json={"notes": "Should not work"},
        )
    assert response.status_code == 401


# --- S2-014: Archive and Restore Tests ---


def test_archive_job(client, test_job):
    """Happy path: archiving a job moves it to archived stage."""
    response = client.post(f"/jobs/{test_job['id']}/archive")
    assert response.status_code == 200
    assert response.json()["stage"] == "archived"


def test_archive_already_archived_job(client, test_job):
    """Archiving an already archived job should return 400."""
    client.post(f"/jobs/{test_job['id']}/archive")
    response = client.post(f"/jobs/{test_job['id']}/archive")
    assert response.status_code == 400


def test_restore_job(client, test_job):
    """Happy path: restoring an archived job to a specified stage."""
    client.post(f"/jobs/{test_job['id']}/archive")
    response = client.post(
        f"/jobs/{test_job['id']}/restore",
        json={"restore_to": "applied"},
    )
    assert response.status_code == 200
    assert response.json()["stage"] == "applied"


def test_restore_non_archived_job(client, test_job):
    """Restoring a job that is not archived should return 400."""
    response = client.post(
        f"/jobs/{test_job['id']}/restore",
        json={"restore_to": "applied"},
    )
    assert response.status_code == 400


def test_restore_to_archived_stage(client, test_job):
    """Restoring a job to archived stage should return 400."""
    client.post(f"/jobs/{test_job['id']}/archive")
    response = client.post(
        f"/jobs/{test_job['id']}/restore",
        json={"restore_to": "archived"},
    )
    assert response.status_code == 400


def test_archive_logs_event(client, test_job, db):
    """Archiving a job should log a stage change event."""
    from sqlmodel import select

    from app.models import JobEvent, JobEventType

    client.post(f"/jobs/{test_job['id']}/archive")
    events = db.exec(
        select(JobEvent).where(
            JobEvent.job_id == test_job["id"],
            JobEvent.event_type == JobEventType.STAGE_CHANGE,
        )
    ).all()
    assert len(events) == 1
    assert events[0].to_stage.value == "archived"


def test_restore_logs_event(client, test_job, db):
    """Restoring a job should log a stage change event with was_override=True."""
    from sqlmodel import select

    from app.models import JobEvent, JobEventType

    client.post(f"/jobs/{test_job['id']}/archive")
    client.post(
        f"/jobs/{test_job['id']}/restore",
        json={"restore_to": "applied"},
    )
    events = db.exec(
        select(JobEvent).where(
            JobEvent.job_id == test_job["id"],
            JobEvent.event_type == JobEventType.STAGE_CHANGE,
        )
    ).all()
    assert len(events) == 2
    restore_event = events[1]
    assert restore_event.from_stage.value == "archived"
    assert restore_event.to_stage.value == "applied"
    assert restore_event.was_override is True


def test_archive_no_token():
    """Unauthenticated archive request should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post("/jobs/fake-id/archive")
    assert response.status_code == 401


# --- S2-021: AI Resume Draft Tests ---


def test_ai_resume_draft_no_token():
    """Unauthenticated AI resume request should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post("/jobs/fake-id/ai/resume")
    assert response.status_code == 401


def test_ai_resume_draft_invalid_job(client):
    """AI resume request for non-existent job should return 404."""
    response = client.post("/jobs/non-existent-id/ai/resume")
    assert response.status_code == 404


def test_ai_resume_draft_returns_draft(client, test_job, monkeypatch):
    """Happy path: AI resume draft returns a draft string and job_id."""
    # TODO: Remove user lookup mock once Sergio's migration adds missing
    # columns (desired_salary_min, desired_salary_max) to users table.
    # Currently using raw SQL workaround in ai.py to avoid column error.
    from unittest.mock import MagicMock

    import anthropic

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="This is a mock resume draft")]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kwargs: mock_client)

    # Patch the raw SQL user lookup to return a mock user
    mock_result = MagicMock()
    mock_result.first_name = "Ronald"
    mock_result.last_name = "Ramirez"
    mock_result.email = "test@example.com"
    mock_result.phone_number = "555-1234"
    mock_result.professional_summary = "Test summary"

    mock_exec = MagicMock()
    mock_exec.first.return_value = mock_result

    monkeypatch.setattr(
        "app.routers.ai.Session.exec",
        lambda self, q: mock_exec,
        raising=False,
    )

    response = client.post(f"/jobs/{test_job['id']}/ai/resume")
    assert response.status_code == 200
    data = response.json()
    assert "draft" in data
    assert data["job_id"] == test_job["id"]
    assert len(data["draft"]) > 0


# --- S2-023: AI Rewrite/Improve Tests ---


def test_ai_rewrite_no_token():
    """Unauthenticated AI rewrite request should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post(
            "/jobs/fake-id/ai/rewrite",
            json={"draft": "Some draft content"},
        )
    assert response.status_code == 401


def test_ai_rewrite_invalid_job(client):
    """AI rewrite request for non-existent job should return 404."""
    response = client.post(
        "/jobs/non-existent-id/ai/rewrite",
        json={"draft": "Some draft content"},
    )
    assert response.status_code == 404


def test_ai_rewrite_returns_improved_draft(client, test_job, monkeypatch):
    """Happy path: AI rewrite returns improved draft and job_id."""
    from unittest.mock import MagicMock

    import anthropic

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="This is an improved draft")]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kwargs: mock_client)

    response = client.post(
        f"/jobs/{test_job['id']}/ai/rewrite",
        json={"draft": "Original draft content here"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "draft" in data
    assert data["job_id"] == test_job["id"]
    assert len(data["draft"]) > 0


def test_ai_rewrite_with_instructions(client, test_job, monkeypatch):
    """Rewrite with optional instructions should still return 200."""
    from unittest.mock import MagicMock

    import anthropic

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="Concise improved draft")]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kwargs: mock_client)

    response = client.post(
        f"/jobs/{test_job['id']}/ai/rewrite",
        json={
            "draft": "Original draft content here",
            "instructions": "make it more concise",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["draft"] == "Concise improved draft"


def test_ai_rewrite_missing_draft(client, test_job):
    """Rewrite request without draft field should return 422."""
    response = client.post(
        f"/jobs/{test_job['id']}/ai/rewrite",
        json={"instructions": "make it better"},
    )
    assert response.status_code == 422


# --- S3-011: Company Research Generation Tests ---
# Rules: S3-BR-002 (ownership)


def test_company_research_no_token():
    """Unauthenticated company research request should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post(
            "/jobs/fake-id/ai/company-research",
            json={"user_context": "What's their engineering culture like?"},
        )
    assert response.status_code == 401


def test_company_research_invalid_job(client):
    """Company research request for non-existent job should return 404."""
    response = client.post(
        "/jobs/non-existent-id/ai/company-research",
        json={"user_context": "What's their engineering culture like?"},
    )
    assert response.status_code == 404


# --- S3-012: Company Research Notes Tests ---
# Rules: S3-BR-002 (ownership), S3-BR-003 (audit-friendly timestamps)


def test_get_research_notes_no_notes_yet(client, test_job):
    """Happy path: a new job has no research notes yet (null, not an error)."""
    response = client.get(f"/jobs/{test_job['id']}/research-notes")
    assert response.status_code == 200
    assert response.json()["company_research_notes"] is None


def test_save_and_get_research_notes(client, test_job):
    """Happy path: saved notes are persisted and retrievable."""
    save_response = client.put(
        f"/jobs/{test_job['id']}/research-notes",
        json={"company_research_notes": "Series B, ~200 employees, remote-friendly"},
    )
    assert save_response.status_code == 200
    assert (
        save_response.json()["company_research_notes"]
        == "Series B, ~200 employees, remote-friendly"
    )

    get_response = client.get(f"/jobs/{test_job['id']}/research-notes")
    assert get_response.status_code == 200
    assert (
        get_response.json()["company_research_notes"]
        == "Series B, ~200 employees, remote-friendly"
    )


def test_save_research_notes_overwrites_existing(client, test_job):
    """Saving again should overwrite, not append to, existing notes."""
    client.put(
        f"/jobs/{test_job['id']}/research-notes",
        json={"company_research_notes": "First draft of notes"},
    )
    response = client.put(
        f"/jobs/{test_job['id']}/research-notes",
        json={"company_research_notes": "Edited notes"},
    )
    assert response.status_code == 200
    assert response.json()["company_research_notes"] == "Edited notes"

    get_response = client.get(f"/jobs/{test_job['id']}/research-notes")
    assert get_response.json()["company_research_notes"] == "Edited notes"


def test_get_research_notes_invalid_job(client):
    """GET research notes for a non-existent job should return 404."""
    response = client.get("/jobs/non-existent-id/research-notes")
    assert response.status_code == 404


def test_save_research_notes_invalid_job(client):
    """PUT research notes for a non-existent job should return 404."""
    response = client.put(
        "/jobs/non-existent-id/research-notes",
        json={"company_research_notes": "Should not save"},
    )
    assert response.status_code == 404


def test_company_research_returns_research(client, test_job, monkeypatch):
    """Happy path: company research returns research text and job_id."""
    from unittest.mock import MagicMock

    import anthropic

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="This is mock company research")]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kwargs: mock_client)

    response = client.post(
        f"/jobs/{test_job['id']}/ai/company-research",
        json={"user_context": "What's their engineering culture like?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "research" in data
    assert data["job_id"] == test_job["id"]
    assert len(data["research"]) > 0


def test_company_research_missing_user_context(client, test_job):
    """Company research request without user_context should return 422."""
    response = client.post(f"/jobs/{test_job['id']}/ai/company-research", json={})
    assert response.status_code == 422


def test_save_research_notes_missing_field(client, test_job):
    """PUT without the required field should return 422."""
    response = client.put(f"/jobs/{test_job['id']}/research-notes", json={})
    assert response.status_code == 422


def test_get_research_notes_no_token():
    """Unauthenticated GET research notes should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/jobs/fake-id/research-notes")
    assert response.status_code == 401


def test_save_research_notes_no_token():
    """Unauthenticated PUT research notes should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.put(
            "/jobs/fake-id/research-notes",
            json={"company_research_notes": "Should not save"},
        )
    assert response.status_code == 401


# --- Job list document flags (N+1 fix) ---


def test_get_jobs_includes_document_flags_false_by_default(client, test_job):
    """Happy path: a job with no linked documents shows both flags false."""
    response = client.get("/jobs")
    assert response.status_code == 200
    job = next(j for j in response.json() if j["id"] == test_job["id"])
    assert job["has_resume"] is False
    assert job["has_cover_letter"] is False


def test_get_jobs_reflects_linked_resume(client, test_job, db):
    """Regression: a linked resume should flip has_resume to true."""
    from app.models import DocType, Document

    db.add(
        Document(
            user_id="test_user_123",
            job_id=test_job["id"],
            title="resume.pdf",
            doc_type=DocType.RESUME,
            document_text="Resume content",
        )
    )
    db.commit()

    response = client.get("/jobs")
    job = next(j for j in response.json() if j["id"] == test_job["id"])
    assert job["has_resume"] is True
    assert job["has_cover_letter"] is False


# --- S3-013: Interview Preparation Notes Tests ---
# Rules: S3-BR-003 (audit-friendly timestamps)


def test_get_interview_prep_notes_no_notes_yet(client, test_job):
    """Happy path: a new job has no interview prep notes yet (all null)."""
    response = client.get(f"/jobs/{test_job['id']}/interview-prep-notes")
    assert response.status_code == 200
    data = response.json()
    assert data["interview_prep_questions"] is None
    assert data["interview_prep_talking_points"] is None
    assert data["interview_prep_logistics"] is None


def test_save_and_get_interview_prep_notes(client, test_job):
    """Happy path: saved notes are persisted and retrievable."""
    save_response = client.put(
        f"/jobs/{test_job['id']}/interview-prep-notes",
        json={
            "interview_prep_questions": "What does a typical day look like?",
            "interview_prep_talking_points": "Mention the React migration project",
            "interview_prep_logistics": "2pm Tuesday, Zoom link in email",
        },
    )
    assert save_response.status_code == 200
    data = save_response.json()
    assert data["interview_prep_questions"] == "What does a typical day look like?"
    assert (
        data["interview_prep_talking_points"] == "Mention the React migration project"
    )
    assert data["interview_prep_logistics"] == "2pm Tuesday, Zoom link in email"

    get_response = client.get(f"/jobs/{test_job['id']}/interview-prep-notes")
    assert get_response.status_code == 200
    assert (
        get_response.json()["interview_prep_questions"]
        == "What does a typical day look like?"
    )


def test_save_interview_prep_notes_partial_fields(client, test_job):
    """Edge case: a user might only fill in one of the three fields;
    the other two should stay null, not get coerced to empty string."""
    response = client.put(
        f"/jobs/{test_job['id']}/interview-prep-notes",
        json={"interview_prep_logistics": "3pm Friday, in person"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["interview_prep_logistics"] == "3pm Friday, in person"
    assert data["interview_prep_questions"] is None
    assert data["interview_prep_talking_points"] is None


def test_save_interview_prep_notes_overwrites_existing(client, test_job):
    """Saving again should overwrite, not merge with, existing notes."""
    client.put(
        f"/jobs/{test_job['id']}/interview-prep-notes",
        json={"interview_prep_questions": "First draft question"},
    )
    response = client.put(
        f"/jobs/{test_job['id']}/interview-prep-notes",
        json={"interview_prep_questions": "Updated question"},
    )
    assert response.status_code == 200
    assert response.json()["interview_prep_questions"] == "Updated question"


def test_get_interview_prep_notes_invalid_job(client):
    response = client.get("/jobs/non-existent-id/interview-prep-notes")
    assert response.status_code == 404


def test_save_interview_prep_notes_invalid_job(client):
    response = client.put(
        "/jobs/non-existent-id/interview-prep-notes",
        json={"interview_prep_questions": "Should not save"},
    )
    assert response.status_code == 404


def test_get_interview_prep_notes_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/jobs/fake-id/interview-prep-notes")
    assert response.status_code == 401


def test_save_interview_prep_notes_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.put(
            "/jobs/fake-id/interview-prep-notes",
            json={"interview_prep_questions": "Should not save"},
        )
    assert response.status_code == 401
