# S3-008: Implement Archive and Restore for Documents
# Verifies archive/restore behavior without hard deletion, per S3-BR-009
# (archive/restore must preserve version history).

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.database import get_db
from app.models import DocStatus, DocType, Document, JobEvent
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


def test_get_document_by_id_success(client, test_document):
    """Happy path: users can load their own document for editing."""
    response = client.get(f"/documents/{test_document.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_document.id
    assert data["title"] == "My Resume"
    assert data["document_text"] == "Some resume content"
    assert data["doc_type"] == "resume"


def test_get_document_by_id_invalid_document(client):
    response = client.get("/documents/non-existent-id")
    assert response.status_code == 404


def test_get_document_by_id_blocks_other_user(client, db):
    other_document = Document(
        user_id="other_user",
        title="Other Resume",
        doc_type=DocType.RESUME,
        status=DocStatus.DRAFT,
        document_text="Private content",
    )
    db.add(other_document)
    db.commit()
    db.refresh(other_document)

    response = client.get(f"/documents/{other_document.id}")
    assert response.status_code == 404


def test_get_document_by_id_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/documents/fake-id")
    assert response.status_code == 401


def test_get_resume_for_job_without_link_returns_null(client, test_job_for_linking):
    response = client.get(f"/documents/resume/job/{test_job_for_linking['id']}")
    assert response.status_code == 200
    assert response.json() is None


def test_get_cover_letter_for_job_without_link_returns_null(
    client, test_job_for_linking
):
    response = client.get(f"/documents/cover-letter/job/{test_job_for_linking['id']}")
    assert response.status_code == 200
    assert response.json() is None


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


# --- Rename ---


def test_rename_document_success(client, test_document):
    """Happy path: renaming updates title without creating a new version."""
    response = client.patch(
        f"/documents/{test_document.id}/rename", json={"title": "Updated Resume Title"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Resume Title"
    # Regression: rename must not bump the version
    assert data["version_number"] == 1
    assert data["version_label"] == "v1"


def test_rename_document_strips_whitespace(client, test_document):
    response = client.patch(
        f"/documents/{test_document.id}/rename", json={"title": "  Padded Title  "}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Padded Title"


def test_rename_document_empty_title(client, test_document):
    """Edge case: empty/whitespace-only title should be rejected."""
    response = client.patch(
        f"/documents/{test_document.id}/rename", json={"title": "   "}
    )
    assert response.status_code == 400


def test_rename_invalid_document(client):
    response = client.patch(
        "/documents/non-existent-id/rename", json={"title": "New Title"}
    )
    assert response.status_code == 404


def test_rename_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.patch(
            "/documents/fake-id/rename", json={"title": "New Title"}
        )
    assert response.status_code == 401


# --- S3-004: Resume Upload Validation ---


def test_upload_resume_rejects_unsupported_type(client, monkeypatch):
    """Edge case: non-pdf/docx/txt files should be rejected with a clear message."""
    response = client.post(
        "/documents/resume/save",
        files={
            "file": ("resume.exe", b"fake binary content", "application/x-msdownload")
        },
        data={"resume_text": "Some resume text"},
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_resume_rejects_oversized_file(client, monkeypatch):
    """Edge case: files over 10MB should be rejected."""
    oversized_content = b"x" * (10 * 1024 * 1024 + 1)
    response = client.post(
        "/documents/resume/save",
        files={"file": ("resume.pdf", oversized_content, "application/pdf")},
        data={"resume_text": "Some resume text"},
    )
    assert response.status_code == 400
    assert "too large" in response.json()["detail"]


def test_upload_resume_rejects_empty_file(client, monkeypatch):
    response = client.post(
        "/documents/resume/save",
        files={"file": ("resume.pdf", b"", "application/pdf")},
        data={"resume_text": "Some resume text"},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]


def test_upload_resume_accepts_pdf(client, monkeypatch):
    """Happy path: a valid PDF should pass validation (storage call mocked)."""
    from app.routers import documents

    async def mock_upload_to_storage(file_bytes, path, content_type):
        return "https://fake-storage-url.com/resume.pdf"

    monkeypatch.setattr(documents, "upload_to_storage", mock_upload_to_storage)

    response = client.post(
        "/documents/resume/save",
        files={"file": ("resume.pdf", b"%PDF-1.4 fake pdf content", "application/pdf")},
        data={"resume_text": "Some resume text"},
    )
    assert response.status_code == 200
    assert response.json()["file_url"] == "https://fake-storage-url.com/resume.pdf"


def test_upload_resume_accepts_txt(client, monkeypatch):
    from app.routers import documents

    async def mock_upload_to_storage(file_bytes, path, content_type):
        return "https://fake-storage-url.com/resume.txt"

    monkeypatch.setattr(documents, "upload_to_storage", mock_upload_to_storage)

    response = client.post(
        "/documents/resume/save",
        files={"file": ("resume.txt", b"Plain text resume content", "text/plain")},
        data={"resume_text": "Some resume text"},
    )
    assert response.status_code == 200


def test_sanitize_pdf_text_handles_unicode_punctuation():
    """Regression: em dashes and smart quotes (common in AI-generated
    text) must not crash PDF generation."""
    from app.routers.documents import sanitize_pdf_text

    text = "I thrive\u2014especially with \u2018smart\u2019 quotes\u2026"
    result = sanitize_pdf_text(text)
    assert "\u2014" not in result
    assert "\u2018" not in result
    assert "\u2019" not in result
    assert "\u2026" not in result
    assert "-" in result


# --- S3-009: Job-to-Library Linking ---


@pytest.fixture(name="second_test_document")
def second_test_document_fixture(db: Session):
    """A second draft resume, unlinked, for replace_existing scenarios."""
    document = Document(
        user_id=TEST_USER_ID,
        title="My Other Resume",
        doc_type=DocType.RESUME,
        status=DocStatus.DRAFT,
        document_text="Different resume content",
        version_label="v1",
        version_number=1,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@pytest.fixture(name="test_job_for_linking")
def test_job_for_linking_fixture(client: TestClient):
    response = client.post(
        "/jobs",
        json={
            "company": "Link Test Co",
            "title": "Engineer",
            "job_posting_body": "Test posting",
        },
    )
    assert response.status_code == 201
    return response.json()


def job_event_notes(db: Session, job_id: str) -> list[str]:
    events = db.exec(
        select(JobEvent).where(JobEvent.job_id == job_id).order_by(JobEvent.created_at)
    ).all()
    return [event.notes for event in events]


def test_save_resume_for_job_records_connected_and_updated_events(
    client, monkeypatch, test_job_for_linking, db
):
    from app.routers import documents

    async def mock_upload_to_storage(file_bytes, path, content_type):
        return "https://fake-storage-url.com/resume.pdf"

    monkeypatch.setattr(documents, "upload_to_storage", mock_upload_to_storage)

    first_response = client.post(
        "/documents/resume/save",
        files={"file": ("resume.pdf", b"%PDF-1.4 fake pdf content", "application/pdf")},
        data={
            "resume_text": "First resume content",
            "job_id": test_job_for_linking["id"],
            "title": "Tailored Resume",
        },
    )
    assert first_response.status_code == 200
    assert job_event_notes(db, test_job_for_linking["id"])[-1] == (
        "Resume connected|Saved Tailored Resume"
    )

    second_response = client.post(
        "/documents/resume/save",
        files={"file": ("resume.pdf", b"%PDF-1.4 fake pdf content", "application/pdf")},
        data={
            "resume_text": "Updated resume content",
            "job_id": test_job_for_linking["id"],
            "title": "Tailored Resume v2",
        },
    )
    assert second_response.status_code == 200
    assert second_response.json()["version_number"] == 2
    assert job_event_notes(db, test_job_for_linking["id"])[-1] == (
        "Resume updated|Saved Tailored Resume v2"
    )


def test_save_cover_letter_for_job_records_connected_and_updated_events(
    client, monkeypatch, test_job_for_linking, db
):
    from app.routers import documents

    async def mock_upload_to_storage(file_bytes, path, content_type):
        return "https://fake-storage-url.com/cover-letter.pdf"

    monkeypatch.setattr(documents, "upload_to_storage", mock_upload_to_storage)

    first_response = client.post(
        "/documents/cover-letter/save",
        json={
            "job_id": test_job_for_linking["id"],
            "cover_letter_text": "Dear team, first draft.",
            "title": "Cover Letter Draft",
        },
    )
    assert first_response.status_code == 200
    assert job_event_notes(db, test_job_for_linking["id"])[-1] == (
        "Cover letter connected|Saved Cover Letter Draft"
    )

    second_response = client.post(
        "/documents/cover-letter/save",
        json={
            "job_id": test_job_for_linking["id"],
            "cover_letter_text": "Dear team, updated draft.",
            "title": "Cover Letter Draft v2",
        },
    )
    assert second_response.status_code == 200
    assert second_response.json()["version_number"] == 2
    assert job_event_notes(db, test_job_for_linking["id"])[-1] == (
        "Cover letter updated|Saved Cover Letter Draft v2"
    )


def test_link_document_to_job_success(client, test_document, test_job_for_linking, db):
    """Happy path: linking a library document to a job with no existing link."""
    response = client.patch(
        f"/documents/{test_document.id}/link-to-job",
        json={
            "job_id": test_job_for_linking["id"],
            "document_type": "resume",
            "replace_existing": False,
        },
    )
    assert response.status_code == 200
    assert response.json()["job_id"] == test_job_for_linking["id"]
    assert job_event_notes(db, test_job_for_linking["id"])[-1] == (
        "Resume linked|Linked My Resume"
    )


def test_link_requires_confirmation_when_one_already_linked(
    client, test_document, second_test_document, test_job_for_linking, db
):
    """Edge case: linking a second resume to a job that already has one
    should be rejected with a 409 unless replace_existing is set."""
    test_document.job_id = test_job_for_linking["id"]
    db.add(test_document)
    db.commit()

    response = client.patch(
        f"/documents/{second_test_document.id}/link-to-job",
        json={
            "job_id": test_job_for_linking["id"],
            "document_type": "resume",
            "replace_existing": False,
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"]["requires_confirmation"] is True


def test_link_with_replace_existing_swaps_document(
    client, test_document, second_test_document, test_job_for_linking, db
):
    """Happy path: replace_existing=true unlinks the old document and
    links the new one."""
    test_document.job_id = test_job_for_linking["id"]
    db.add(test_document)
    db.commit()

    response = client.patch(
        f"/documents/{second_test_document.id}/link-to-job",
        json={
            "job_id": test_job_for_linking["id"],
            "document_type": "resume",
            "replace_existing": True,
        },
    )
    assert response.status_code == 200
    assert response.json()["job_id"] == test_job_for_linking["id"]

    # Regression: old document is unlinked, not deleted
    old_doc = db.get(Document, test_document.id)
    assert old_doc is not None
    assert old_doc.job_id is None
    assert job_event_notes(db, test_job_for_linking["id"])[-1] == (
        "Resume replaced|Replaced My Resume with My Other Resume"
    )


def test_link_wrong_document_type_rejected(client, test_document, test_job_for_linking):
    """Edge case: document_type in payload must match the document's actual type."""
    response = client.patch(
        f"/documents/{test_document.id}/link-to-job",
        json={
            "job_id": test_job_for_linking["id"],
            "document_type": "cover_letter",
            "replace_existing": False,
        },
    )
    assert response.status_code == 400


def test_link_invalid_job(client, test_document):
    response = client.patch(
        f"/documents/{test_document.id}/link-to-job",
        json={
            "job_id": "non-existent-id",
            "document_type": "resume",
            "replace_existing": False,
        },
    )
    assert response.status_code == 404


def test_link_invalid_document(client, test_job_for_linking):
    response = client.patch(
        "/documents/non-existent-id/link-to-job",
        json={
            "job_id": test_job_for_linking["id"],
            "document_type": "resume",
            "replace_existing": False,
        },
    )
    assert response.status_code == 404


def test_unlink_document_success(client, test_document, test_job_for_linking, db):
    """Happy path: unlinking removes the job association without deleting."""
    test_document.job_id = test_job_for_linking["id"]
    db.add(test_document)
    db.commit()

    response = client.patch(
        f"/documents/{test_document.id}/unlink-from-job",
        json={"job_id": test_job_for_linking["id"], "document_type": "resume"},
    )
    assert response.status_code == 200
    assert response.json()["job_id"] is None

    # Regression: document still exists
    still_there = db.get(Document, test_document.id)
    assert still_there is not None
    assert job_event_notes(db, test_job_for_linking["id"])[-1] == (
        "Resume unlinked|Removed My Resume"
    )


def test_unlink_document_not_linked_rejected(
    client, test_document, test_job_for_linking
):
    """Edge case: unlinking a document that isn't linked to this job fails."""
    response = client.patch(
        f"/documents/{test_document.id}/unlink-from-job",
        json={"job_id": test_job_for_linking["id"], "document_type": "resume"},
    )
    assert response.status_code == 400


def test_unlink_invalid_document(client, test_job_for_linking):
    response = client.patch(
        "/documents/non-existent-id/unlink-from-job",
        json={"job_id": test_job_for_linking["id"], "document_type": "resume"},
    )
    assert response.status_code == 404


def test_link_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.patch(
            "/documents/fake-id/link-to-job",
            json={
                "job_id": "fake-job",
                "document_type": "resume",
                "replace_existing": False,
            },
        )
    assert response.status_code == 401


def test_unlink_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.patch(
            "/documents/fake-id/unlink-from-job",
            json={"job_id": "fake-job", "document_type": "resume"},
        )
    assert response.status_code == 401


# --- S3-005: Document Export ---


def test_export_document_as_txt(client, test_document):
    """Happy path: exporting as txt returns the raw text with correct headers."""
    response = client.get(f"/documents/{test_document.id}/export?format=txt")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.decode("utf-8") == "Some resume content"


def test_export_document_as_pdf(client, test_document):
    """Happy path: exporting as pdf returns a valid PDF byte stream."""
    response = client.get(f"/documents/{test_document.id}/export?format=pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_export_document_as_docx(client, test_document):
    """Happy path: exporting as docx returns a valid docx byte stream."""
    response = client.get(f"/documents/{test_document.id}/export?format=docx")
    assert response.status_code == 200
    assert (
        response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    # docx files are zip archives; PK is the zip file magic number
    assert response.content.startswith(b"PK")


def test_export_document_invalid_format(client, test_document):
    """Edge case: unsupported format should be rejected."""
    response = client.get(f"/documents/{test_document.id}/export?format=exe")
    assert response.status_code == 400


def test_export_document_invalid_id(client):
    response = client.get("/documents/non-existent-id/export?format=txt")
    assert response.status_code == 404


def test_export_document_no_content(client, db):
    """Edge case: a document with no text content should be rejected
    with a clear message rather than exporting an empty file."""
    empty_doc = Document(
        user_id=TEST_USER_ID,
        title="Empty Draft",
        doc_type=DocType.RESUME,
        document_text=None,
    )
    db.add(empty_doc)
    db.commit()
    db.refresh(empty_doc)

    response = client.get(f"/documents/{empty_doc.id}/export?format=txt")
    assert response.status_code == 400


def test_export_specific_version(client, test_document, db):
    """Happy path: exporting a specific version_id returns that
    version's text, not the document's current text."""
    from app.models import DocumentVersion

    old_version = DocumentVersion(
        document_id=test_document.id,
        user_id=TEST_USER_ID,
        version_number=0,
        version_label="v0",
        document_text="Older resume content",
    )
    db.add(old_version)
    db.commit()
    db.refresh(old_version)

    response = client.get(
        f"/documents/{test_document.id}/export?format=txt&version_id={old_version.id}"
    )
    assert response.status_code == 200
    assert response.content.decode("utf-8") == "Older resume content"


def test_export_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/documents/fake-id/export?format=txt")
    assert response.status_code == 401


# --- S3-021: Document Versioning ---
# Rules: S3-BR-007 (explicit action only), S3-BR-008 (version metadata)


def test_get_document_versions_empty_for_new_document(client, test_document):
    """Happy path: a freshly created document has no version history yet."""
    response = client.get(f"/documents/{test_document.id}/versions")
    assert response.status_code == 200
    assert response.json() == []


def test_create_document_version_success(client, test_document):
    """Happy path: creating a version snapshots current state and
    advances the document's version pointer."""
    response = client.post(
        f"/documents/{test_document.id}/versions", json={"version_label": "v2"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version_number"] == 2
    assert data["version_label"] == "v2"
    assert "version_id" in data
    assert "created_at" in data


def test_create_document_version_default_label(client, test_document):
    """Edge case: no version_label provided should default to v{next}."""
    response = client.post(f"/documents/{test_document.id}/versions", json={})
    assert response.status_code == 200
    assert response.json()["version_label"] == "v2"


def test_create_document_version_advances_document_pointer(client, test_document, db):
    """Regression: creating a version updates the parent document's own
    version_number/version_label, not just the history table."""
    client.post(f"/documents/{test_document.id}/versions", json={})
    updated_doc = db.get(Document, test_document.id)
    assert updated_doc.version_number == 2
    assert updated_doc.version_label == "v2"


def test_get_document_versions_returns_history_after_creation(client, test_document):
    """Happy path: version history reflects created versions, newest first."""
    client.post(f"/documents/{test_document.id}/versions", json={"version_label": "v2"})
    client.post(f"/documents/{test_document.id}/versions", json={"version_label": "v3"})

    response = client.get(f"/documents/{test_document.id}/versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 2
    # ordered descending by version_number
    assert versions[0]["version_number"] == 3
    assert versions[1]["version_number"] == 2


def test_document_version_carries_ownership_and_timestamp(client, test_document):
    """Regression: every version carries owner id and timestamp (S3-BR-008)."""
    client.post(f"/documents/{test_document.id}/versions", json={})
    response = client.get(f"/documents/{test_document.id}/versions")
    version = response.json()[0]
    assert version["owner_id"] == TEST_USER_ID
    assert version["created_at"] is not None


def test_create_document_version_preserves_original_content(client, test_document, db):
    """Regression: creating a version does not alter the document's
    current content, it only snapshots what was already there."""
    original_text = test_document.document_text
    client.post(f"/documents/{test_document.id}/versions", json={})
    unchanged_doc = db.get(Document, test_document.id)
    assert unchanged_doc.document_text == original_text


def test_create_document_version_invalid_document(client):
    response = client.post("/documents/non-existent-id/versions", json={})
    assert response.status_code == 404


def test_get_document_versions_invalid_document(client):
    response = client.get("/documents/non-existent-id/versions")
    assert response.status_code == 404


def test_create_document_version_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.post("/documents/fake-id/versions", json={})
    assert response.status_code == 401


def test_get_document_versions_no_token():
    with patch("app.dependencies.get_jwks", return_value={"keys": []}):
        test_client = TestClient(app)
        response = test_client.get("/documents/fake-id/versions")
    assert response.status_code == 401
