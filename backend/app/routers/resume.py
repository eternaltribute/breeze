import os
import time
from typing import Optional

import anthropic
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select, text

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Job, Resume

router = APIRouter(prefix="/resume", tags=["resume"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "resumes"


@router.post("/save")
async def save_resume(
    file: UploadFile = File(...),
    resume_text: str = Form(...),
    job_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    file_bytes = await file.read()
    path = f"{user_id}/{int(time.time())}_{file.filename}"

    # uploading the file to our db
    async with httpx.AsyncClient() as client:
        upload_response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": file.content_type,
                "x-upsert": "true",
            },
            content=file_bytes,
        )
        if upload_response.status_code not in (200, 201):
            raise HTTPException(
                status_code=500,
                detail=f"File upload failed: {upload_response.text}",
            )

    # Get a long-lived signed URL
    async with httpx.AsyncClient() as client:
        sign_response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            },
            json={"expiresIn": 31536000},
        )
        sign_data = sign_response.json()
        signed_path = sign_data.get("signedURL") or sign_data.get("signedUrl", "")
        file_url = f"{SUPABASE_URL}/storage/v1{signed_path}" if signed_path else None

    # Save record to DB
    record = Resume(
        user_id=user_id,
        job_id=job_id or None,
        file_name=file.filename,
        file_url=file_url,
        resume_text=resume_text,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"document_id": record.id, "file_url": file_url}


@router.get("/job/{job_id}")
def get_resume_for_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    record = db.exec(
        select(Resume)
        .where(Resume.job_id == job_id)
        .where(Resume.user_id == user_id)
        .order_by(Resume.updated_at.desc())
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="No resume found")

    return {
        "document_id": record.id,
        "resume_text": record.resume_text,
        "file_name": record.file_name,
        "file_url": record.file_url,
    }


@router.post("/parse-pdf")
async def parse_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Extract text from an uploaded PDF file."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")

    file_bytes = await file.read()

    try:
        import io

        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

        if not text.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from PDF. Try pasting text directly.",
            )

        return {"text": text.strip()}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")


class GenerateForJobRequest(BaseModel):
    job_id: str


@router.post("/generate-for-job")
async def generate_resume_for_job(
    payload: GenerateForJobRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = current_user.get("sub")

    # Fetch job and verify ownership
    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Fetch user profile
    result = db.exec(
        text(
            "SELECT first_name, last_name, email, phone_number, professional_summary "
            "FROM users WHERE id = :user_id"
        ).bindparams(user_id=user_id)
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    profile_context = f"""
Name: {result.first_name or ''} {result.last_name or ''}
Email: {result.email or ''}
Phone: {result.phone_number or 'Not provided'}
Summary: {result.professional_summary or 'Not provided'}
""".strip()

    job_context = f"""
Company: {job.company}
Title: {job.title}
Job Posting:
{job.job_posting_body}
""".strip()

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


class ImproveResumeRequest(BaseModel):
    resume_text: str
    instruction: str


@router.post("/improve")
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
