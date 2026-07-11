# S3-008: Implement Archive and Restore for Documents
# Verifies archive/restore behavior without hard deletion, per S3-BR-009
# (archive/restore must preserve version history).

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_db
from app.models import DocStatus, DocType, Document
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


@pytest.fixture(name="test_document")
def test_document_fixture(db: Session):
    """A draft document owned by TEST_USER_ID, not linked to any job."""
    document = Document(
        user_id=TEST_USER_ID,
        title="My Resume",
        doc_type=DocType.RESUME,
        status=DocStatus.DRAFT,
        document_text="Some resume content",
        version_label="v1",
        version_number=1,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


# --- Archive ---


def test_archive_document_success(client, test_document):
    """Happy path: archiving sets status without deleting content."""
    response = client.post(f"/documents/{test_document.id}/archive")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "archived"
    # Regression-style check: version history / content untouched
    assert data["document_text"] == "Some resume content"
    assert data["version_label"] == "v1"


def test_archive_already_archived_document(client, test_document):
    """Edge case: archiving twice should fail cleanly, not double-process."""
    client.post(f"/documents/{test_document.id}/archive")
    response = client.post(f"/documents/{test_document.id}/archive")
    assert response.status_code == 400


def test_archive_invalid_document(client):
    response = client.post("/documents/non-existent-id/archive")
    assert response.status_code == 404


def test_archive_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post("/documents/fake-id/archive")
    assert response.status_code == 401


# --- Restore ---


def test_restore_document_success(client, test_document):
    """Happy path: restoring an archived document brings it back to draft."""
    client.post(f"/documents/{test_document.id}/archive")
    response = client.post(
        f"/documents/{test_document.id}/restore", json={"restore_to": "draft"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "draft"


def test_restore_to_final(client, test_document):
    client.post(f"/documents/{test_document.id}/archive")
    response = client.post(
        f"/documents/{test_document.id}/restore", json={"restore_to": "final"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "final"


def test_restore_non_archived_document(client, test_document):
    """Edge case: can't restore a document that was never archived."""
    response = client.post(
        f"/documents/{test_document.id}/restore", json={"restore_to": "draft"}
    )
    assert response.status_code == 400


def test_restore_to_archived_rejected(client, test_document):
    """Edge case: restoring back into 'archived' status makes no sense."""
    client.post(f"/documents/{test_document.id}/archive")
    response = client.post(
        f"/documents/{test_document.id}/restore", json={"restore_to": "archived"}
    )
    assert response.status_code == 400


def test_restore_invalid_status(client, test_document):
    client.post(f"/documents/{test_document.id}/archive")
    response = client.post(
        f"/documents/{test_document.id}/restore", json={"restore_to": "bogus"}
    )
    assert response.status_code == 400


def test_restore_invalid_document(client):
    response = client.post(
        "/documents/non-existent-id/restore", json={"restore_to": "draft"}
    )
    assert response.status_code == 404


def test_restore_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post(
            "/documents/fake-id/restore", json={"restore_to": "draft"}
        )
    assert response.status_code == 401


# --- Regression: archive/restore must not touch version history ---


def test_archive_preserves_document_content(client, db, test_document):
    """Regression: archiving must not delete the document or its text,
    per S3-BR-009 (no hard deletion)."""
    client.post(f"/documents/{test_document.id}/archive")

    # Confirm the row still exists in the database at all
    still_there = db.get(Document, test_document.id)
    assert still_there is not None
    assert still_there.document_text == "Some resume content"
