import os
import time
from datetime import datetime
from typing import Optional

import anthropic
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fpdf import FPDF
from pydantic import BaseModel
from sqlmodel import Session, select, text

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    DocType,
    Document,
    DocumentVersion,
    Education,
    Experience,
    Job,
    JobEvent,
    JobEventType,
    Skill,
    UserSkill,
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "documents"

router = APIRouter(prefix="/documents", tags=["documents"])


# ── Request models ────────────────────────────────────────────────────────────


class SaveCoverLetterRequest(BaseModel):
    job_id: str
    cover_letter_text: str


class GenerateCoverLetterRequest(BaseModel):
    job_id: str
    profile: dict


class ImproveCoverLetterRequest(BaseModel):
    job_id: str
    cover_letter_text: str
    instruction: str


class GenerateForJobRequest(BaseModel):
    job_id: str


class ImproveResumeRequest(BaseModel):
    resume_text: str
    instruction: str


class CreateVersionRequest(BaseModel):
    version_label: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def generate_pdf(text: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(25, 25, 25)
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 7, text)
    return bytes(pdf.output())


@router.post("/{document_id}/versions")
def create_document_version(
    document_id: str,
    payload: CreateVersionRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    doc = db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Calculate next version number
    next_version = (doc.version_number or 0) + 1

    # Snapshot current state into document_versions
    version = DocumentVersion(
        document_id=document_id,
        user_id=user_id,
        version_number=next_version,
        version_label=payload.version_label or f"v{next_version}",
        document_text=doc.document_text,
        file_url=doc.file_url,
    )
    db.add(version)

    # Update current version metadata on the document
    doc.version_number = next_version
    doc.version_label = version.version_label
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(version)

    return {
        "version_id": version.id,
        "version_number": version.version_number,
        "version_label": version.version_label,
        "created_at": version.created_at.isoformat(),
    }


@router.get("/{document_id}/versions")
def get_document_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    doc = db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")

    versions = db.exec(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_number.desc())
    ).all()

    return [
        {
            "version_id": v.id,
            "version_number": v.version_number,
            "version_label": v.version_label,
            "document_text": v.document_text,
            "file_url": v.file_url,
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


async def upload_to_storage(
    file_bytes: bytes, path: str, content_type: str
) -> Optional[str]:  # noqa: E501
    async with httpx.AsyncClient() as client:
        upload_res = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=file_bytes,
        )
        if upload_res.status_code not in (200, 201):
            raise HTTPException(
                status_code=500, detail=f"Upload failed:{upload_res.text}"
            )  # noqa: E501

        sign_res = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            },
            json={"expiresIn": 31536000},
        )
        sign_data = sign_res.json()
        signed_path = sign_data.get("signedURL") or sign_data.get("signedUrl", "")
        return f"{SUPABASE_URL}/storage/v1{signed_path}" if signed_path else None


# ── Resume endpoints ──────────────────────────────────────────────────────────


@router.get("/resume/job/{job_id}")
def get_resume_for_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    record = db.exec(
        select(Document)
        .where(Document.job_id == job_id)
        .where(Document.user_id == user_id)
        .where(Document.doc_type == DocType.RESUME)
        .order_by(Document.updated_at.desc())
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="No resume found")

    return {
        "document_id": record.id,
        "resume_text": record.document_text,
        "file_name": record.file_name,
        "file_url": record.file_url,
    }


@router.post("/resume/save")
async def save_resume(
    file: UploadFile = File(...),
    resume_text: str = Form(...),
    job_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    file_bytes = await file.read()
    path = f"{user_id}/resume/{int(time.time())}_{file.filename}"

    file_url = await upload_to_storage(file_bytes, path, file.content_type)

    record = Document(
        user_id=user_id,
        job_id=job_id or None,
        title=file.filename,
        doc_type=DocType.RESUME,
        file_name=file.filename,
        file_url=file_url,
        document_text=resume_text,
    )
    db.add(record)
    if job_id:
        db.add(
            JobEvent(
                job_id=job_id,
                owner_id=user_id,
                event_type=JobEventType.DOCUMENT,
                notes=f"Resume connected|Saved {file.filename}",
                created_at=datetime.utcnow(),
            )
        )
    db.commit()
    db.refresh(record)

    return {"document_id": record.id, "file_url": file_url}


@router.get("/resume/latest")
def get_latest_resume(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    record = db.exec(
        select(Document)
        .where(Document.user_id == user_id)
        .where(Document.doc_type == DocType.RESUME)
        .order_by(Document.created_at.desc())
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="No resume found")

    return {
        "document_id": record.id,
        "file_url": record.file_url,
        "file_name": record.file_name,
        "resume_text": record.document_text,
    }


@router.post("/resume/parse-pdf")
async def parse_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    file_bytes = await file.read()
    try:
        import io

        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        text_content = "".join(page.extract_text() or "" for page in reader.pages)
        if not text_content.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from PDF. Try pasting text directly.",
            )  # noqa: E501
        return {"text": text_content.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")


@router.post("/resume/generate-for-job")
async def generate_resume_for_job(
    payload: GenerateForJobRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()  # noqa: E501
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = db.exec(
        text(
            "SELECT first_name, last_name, email, phone_number, professional_summary "
            "FROM users WHERE id = :user_id"
        ).bindparams(user_id=user_id)
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    profile_context = (
        f"Name: {result.first_name or ''} {result.last_name or ''}\n"
        f"Email: {result.email or ''}\n"
        f"Phone: {result.phone_number or 'Not provided'}\n"
        f"Summary: {result.professional_summary or 'Not provided'}"
    )
    job_context = (
        f"Company: {job.company}\nTitle: {job.title}\n"
        f"Job Posting:\n{job.job_posting_body}"
    )

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Generate a professional resume tailored for this job posting. "
                    f"Use the candidate profile to personalize it.\n\n"
                    f"CANDIDATE PROFILE:\n{profile_context}\n\n"
                    f"JOB DETAILS:\n{job_context}\n\n"
                    f"Return clean plain text resume only."
                ),
            }
        ],
    )
    return {"resume_text": message.content[0].text}


@router.post("/resume/improve")
async def improve_resume(
    payload: ImproveResumeRequest,
    current_user: dict = Depends(get_current_user),
):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Please improve the following resume based on this instruction: "
                    f"{payload.instruction}\n\n"
                    f"RESUME:\n{payload.resume_text}\n\n"
                    f"Return the improved resume in plain text only."
                ),
            }
        ],
    )

    return {"improved_text": message.content[0].text}


# ── Cover letter endpoints ────────────────────────────────────────────────────


@router.post("/cover-letter/generate")
async def generate_cover_letter(
    payload: GenerateCoverLetterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()  # noqa: E501
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    skills = db.exec(
        select(Skill)
        .join(UserSkill, Skill.id == UserSkill.skill_id)
        .where(UserSkill.user_id == user_id)
    ).all()
    education = db.exec(
        select(Education).where(Education.user_id == user_id).order_by(Education.order)
    ).all()
    experiences = db.exec(
        select(Experience)
        .where(Experience.user_id == user_id)
        .order_by(Experience.order)
    ).all()

    skills_text = ", ".join([s.name for s in skills]) if skills else "Not provided"
    education_text = (
        "\n".join(
            [
                f"- {e.degree} in {e.field_of_study} at {e.school} ({e.start_date} – {e.end_date})"  # noqa: E501
                for e in education
            ]
        )
        if education
        else "Not provided"
    )
    experience_text = (
        "\n".join(
            [
                f"- {e.title} at {e.company} ({e.start_date} – {e.end_date}): {e.description}"  # noqa: E501
                for e in experiences
            ]
        )
        if experiences
        else "Not provided"
    )

    profile = payload.profile
    prompt = (
        f"Write a professional cover letter for the following job application.\n\n"
        f"Applicant:\n"
        f"- Name: {profile.get('firstName', '')} {profile.get('lastName', '')}\n"
        f"- Email: {profile.get('email', '')}\n"
        f"- Phone: {profile.get('phone', '')}\n"
        f"- Summary: {profile.get('summary', '')}\n\n"
        f"Skills: {skills_text}\n\n"
        f"Education:\n{education_text}\n\n"
        f"Work Experience:\n{experience_text}\n\n"
        f"Job:\n"
        f"- Title: {job.title}\n"
        f"- Company: {job.company}\n"
        f"- Location: {job.location or 'Not specified'}\n"
        f"- Description: {job.job_posting_body or 'Not provided'}\n\n"
        "Write a compelling, professional cover letter in first person. "
        "Tailor it specifically to the job description and highlight relevant "
        "skills and experience. Do not include a subject line or email headers. "
        "Start directly with the salutation."
    )

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return {"cover_letter": message.content[0].text}


@router.post("/cover-letter/improve")
async def improve_cover_letter(
    payload: ImproveCoverLetterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()  # noqa: E501
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    instruction = payload.instruction
    prompt = (
        "Improve the following cover letter based on this instruction: "
        f'"{instruction}"\n\n'
        f"Current cover letter:\n{payload.cover_letter_text}\n\n"
        "Return only the improved cover letter text, no explanations."
    )

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return {"improved_text": message.content[0].text}


@router.post("/cover-letter/save")
async def save_cover_letter(
    payload: SaveCoverLetterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    pdf_bytes = generate_pdf(payload.cover_letter_text)
    file_name = f"cover_letter_{job.company}_{job.title}.pdf".replace(" ", "_")
    path = f"{user_id}/cover_letter/{int(time.time())}_{file_name}"

    file_url = await upload_to_storage(pdf_bytes, path, "application/pdf")

    existing = db.exec(
        select(Document)
        .where(Document.job_id == payload.job_id)
        .where(Document.user_id == user_id)
        .where(Document.doc_type == DocType.COVER_LETTER)
    ).first()

    if existing:
        existing.document_text = payload.cover_letter_text
        existing.file_name = file_name
        existing.file_url = file_url
        existing.updated_at = datetime.utcnow()
        db.add(
            JobEvent(
                job_id=payload.job_id,
                owner_id=user_id,
                event_type=JobEventType.DOCUMENT,
                notes=f"Cover letter updated|Saved {file_name}",
                created_at=datetime.utcnow(),
            )
        )
        db.commit()
        db.refresh(existing)
        return {"document_id": existing.id, "file_url": file_url}

    record = Document(
        user_id=user_id,
        job_id=payload.job_id,
        title=file_name,
        doc_type=DocType.COVER_LETTER,
        file_name=file_name,
        file_url=file_url,
        document_text=payload.cover_letter_text,
    )
    db.add(record)
    db.add(
        JobEvent(
            job_id=payload.job_id,
            owner_id=user_id,
            event_type=JobEventType.DOCUMENT,
            notes=f"Cover letter connected|Saved {file_name}",
            created_at=datetime.utcnow(),
        )
    )
    db.commit()
    db.refresh(record)
    return {"document_id": record.id, "file_url": file_url}


@router.get("/cover-letter/job/{job_id}")
def get_cover_letter(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    record = db.exec(
        select(Document)
        .where(Document.job_id == job_id)
        .where(Document.user_id == user_id)
        .where(Document.doc_type == DocType.COVER_LETTER)
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="No cover letter found")

    return {
        "document_id": record.id,
        "cover_letter_text": record.document_text,
        "file_url": record.file_url,
    }


# ── General document endpoints ────────────────────────────────────────────────


@router.get("")
def get_documents(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    records = db.exec(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    ).all()
    return records


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    record = db.get(Document, document_id)
    if not record or record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(record)
    db.commit()
    return {"message": "Deleted"}
