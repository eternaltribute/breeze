import os
import time
from datetime import datetime

import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fpdf import FPDF
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CoverLetter, Education, Experience, Job, Skill, UserSkill

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "cover-letters"

router = APIRouter(prefix="/cover-letter", tags=["cover_letter"])


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


def generate_pdf(text: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(25, 25, 25)
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 7, text)
    return bytes(pdf.output())


@router.post("/generate")
async def generate_cover_letter(
    payload: GenerateCoverLetterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    skills = db.exec(
        select(Skill)
        .join(UserSkill, Skill.id == UserSkill.skill_id)
        .where(UserSkill.user_id == user_id)
    ).all()
    skills_text = ", ".join([s.name for s in skills]) if skills else "Not provided"
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
    prompt = f"""Write a professional cover letter for the following job application.

Applicant:
- Name: {profile.get('firstName', '')} {profile.get('lastName', '')}
- Email: {profile.get('email', '')}
- Phone: {profile.get('phone', '')}
- Summary: {profile.get('summary', '')}

Skills: {skills_text}

Education:
{education_text}

Work Experience:
{experience_text}

Job:
- Title: {job.title}
- Company: {job.company}
- Location: {job.location or 'Not specified'}
- Description: {job.job_posting_body or 'Not provided'}

Write a compelling, professional cover letter in first person. Tailor it specifically to the job description and highlight relevant skills and experience. Do not include a subject line or email headers. Start directly with the salutation."""  # noqa: E501

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return {"cover_letter": message.content[0].text}


@router.post("/improve")
async def improve_cover_letter(
    payload: ImproveCoverLetterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()
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


@router.post("/save")
async def save_cover_letter(
    payload: SaveCoverLetterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    # S2-BR-021: verify job belongs to this user
    job = db.exec(
        select(Job).where(Job.id == payload.job_id, Job.owner_id == user_id)
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Generate PDF from text
    pdf_bytes = generate_pdf(payload.cover_letter_text)
    file_name = f"cover_letter_{job.company}_{job.title}.pdf".replace(" ", "_")
    path = f"{user_id}/{int(time.time())}_{file_name}"

    # Upload to Supabase Storage
    async with httpx.AsyncClient() as client:
        upload_res = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/pdf",
                "x-upsert": "true",
            },
            content=pdf_bytes,
        )
        if upload_res.status_code not in (200, 201):
            raise HTTPException(
                status_code=500, detail=f"Upload failed: {upload_res.text}"
            )

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
        file_url = f"{SUPABASE_URL}/storage/v1{signed_path}" if signed_path else None

    # Upsert — one cover letter per job per user
    existing = db.exec(
        select(CoverLetter)
        .where(CoverLetter.job_id == payload.job_id)
        .where(CoverLetter.user_id == user_id)
    ).first()

    if existing:
        existing.cover_letter_text = payload.cover_letter_text
        existing.file_name = file_name
        existing.file_url = file_url
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return {"document_id": existing.id, "file_url": file_url}

    record = CoverLetter(
        user_id=user_id,
        job_id=payload.job_id,
        cover_letter_text=payload.cover_letter_text,
        file_name=file_name,
        file_url=file_url,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"document_id": record.id, "file_url": file_url}


@router.get("/job/{job_id}")
def get_cover_letter(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")

    record = db.exec(
        select(CoverLetter)
        .where(CoverLetter.job_id == job_id)
        .where(CoverLetter.user_id == user_id)
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="No cover letter found")

    return {
        "document_id": record.id,
        "cover_letter_text": record.cover_letter_text,
        "file_url": record.file_url,
    }
