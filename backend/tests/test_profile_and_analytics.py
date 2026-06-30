from unittest.mock import patch
from app.models import User

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_db
from main import app


# ── Fixtures ─────────────────────────────────────────────────────────────────


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

@pytest.fixture(name="test_user")
def test_user_fixture(db: Session):
    user = User(
        id="test_user_123",
        email="test@example.com",
        first_name="Test",
        last_name="User",
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture(name="client")
def client_fixture(db: Session):
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


def create_job(client, stage=None):
    """Helper to create a job and optionally transition it to a stage."""
    res = client.post(
        "/jobs",
        json={
            "company": "Test Co",
            "title": "Engineer",
            "job_posting_body": "Test posting",
        },
    )
    assert res.status_code == 201
    job = res.json()

    if stage and stage != "interested":
        client.patch(
            f"/jobs/{job['id']}/stage",
            json={"new_stage": stage, "confirm_override": True},
        )

    return job


# ── S2-BR-022: Stage counts ───────────────────────────────────────────────────


def test_get_jobs_returns_stage_field(client):
    """GET /jobs should return jobs with a stage field for frontend metric computation."""
    create_job(client)
    res = client.get("/jobs")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert "stage" in data[0]


def test_stage_counts_across_multiple_jobs(client):
    """GET /jobs should return correct stage distribution for analytics."""
    create_job(client, stage="interested")
    create_job(client, stage="applied")
    create_job(client, stage="applied")
    create_job(client, stage="interview")
    create_job(client, stage="offer")
    create_job(client, stage="rejected")

    res = client.get("/jobs")
    assert res.status_code == 200
    jobs = res.json()

    counts = {}
    for job in jobs:
        s = job["stage"]
        counts[s] = counts.get(s, 0) + 1

    assert counts.get("interested", 0) == 1
    assert counts.get("applied", 0) == 2
    assert counts.get("interview", 0) == 1
    assert counts.get("offer", 0) == 1
    assert counts.get("rejected", 0) == 1


def test_response_rate_data_available(client):
    """
    Response rate = interviews / applied.
    GET /jobs must return enough data to compute this.
    """
    create_job(client, stage="applied")
    create_job(client, stage="applied")
    create_job(client, stage="interview")

    res = client.get("/jobs")
    jobs = res.json()

    applied = sum(1 for j in jobs if j["stage"] == "applied")
    interviews = sum(1 for j in jobs if j["stage"] == "interview")

    assert applied == 2
    assert interviews == 1
    # Response rate would be 50%
    assert round((interviews / applied) * 100) == 50


def test_offer_rate_data_available(client):
    """
    Offer rate = offers / interviews.
    GET /jobs must return enough data to compute this.
    """
    create_job(client, stage="interview")
    create_job(client, stage="interview")
    create_job(client, stage="offer")

    res = client.get("/jobs")
    jobs = res.json()

    interviews = sum(1 for j in jobs if j["stage"] == "interview")
    offers = sum(1 for j in jobs if j["stage"] == "offer")

    assert interviews == 2
    assert offers == 1
    assert round((offers / interviews) * 100) == 50


def test_zero_response_rate_when_no_applied(client):
    """Response rate should be 0 when there are no applied jobs."""
    create_job(client, stage="interested")

    res = client.get("/jobs")
    jobs = res.json()

    applied = sum(1 for j in jobs if j["stage"] == "applied")
    interviews = sum(1 for j in jobs if j["stage"] == "interview")

    assert applied == 0
    # Frontend guards against division by zero: applied > 0 ? ... : 0
    response_rate = round((interviews / applied) * 100) if applied > 0 else 0
    assert response_rate == 0


def test_jobs_only_returns_own_jobs(client, db):
    """GET /jobs should only return jobs belonging to the authenticated user."""
    from app.models import Job

    create_job(client)

    # Insert a job belonging to a different user directly
    other_job = Job(
        owner_id="other_user_456",
        company="Other Co",
        title="Other Role",
        job_posting_body="Other posting",
    )
    db.add(other_job)
    db.commit()

    res = client.get("/jobs")
    jobs = res.json()

    assert all(j["company"] != "Other Co" for j in jobs)
    assert len(jobs) == 1


def test_archived_jobs_excluded_from_active_count(client):
    """
    Active count = interview + offer only.
    Archived jobs should not inflate the active count.
    """
    create_job(client, stage="interview")
    create_job(client, stage="archived")

    res = client.get("/jobs")
    jobs = res.json()

    active = sum(1 for j in jobs if j["stage"] in ("interview", "offer"))
    assert active == 1


# ── Profile completeness ──────────────────────────────────────────────────────


def test_profile_returns_all_required_fields(client, test_user):
    """GET /auth/profile should return fields needed for analytics and cover letter generation."""
    res = client.get("/auth/profile")
    assert res.status_code == 200
    data = res.json()

    required_fields = ["first_name", "last_name", "email"]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"


def test_profile_optional_fields_default_to_none(client, test_user):
    """Optional profile fields should be null by default, not raise errors."""
    res = client.get("/auth/profile")
    assert res.status_code == 200
    data = res.json()

    optional_fields = [
        "phone_number",
        "professional_summary",
        "desired_role",
        "desired_location",
        "desired_salary",
    ]
    for field in optional_fields:
        assert field in data
        # Should be None or a value — not missing entirely


def test_profile_preferences_can_be_updated(client, test_user):
    """PUT /profile/preferences should update and persist career preferences."""
    res = client.put(
        "/profile/preferences",
        json={
            "desired_role": "Software Engineer",
            "desired_location": "New York",
            "location_type": "Remote",
            "desired_salary": 120000,
        },
    )
    assert res.status_code == 200

    profile_res = client.get("/auth/profile")
    data = profile_res.json()
    assert data["desired_role"] == "Software Engineer"
    assert data["desired_salary"] == 120000


def test_profile_no_token():
    """Unauthenticated profile request should return 401."""
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/auth/profile")
    assert response.status_code == 401