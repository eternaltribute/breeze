# S2-021: AI Resume Draft from Profile + Job Context
# Generates a resume draft using Anthropic Claude API
# Rules: S2-BR-018 (explicit user action), S2-BR-019 (profile + job context),
# S2-BR-020 (output is editable before save)

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Job

router = APIRouter(prefix="/jobs", tags=["ai"])


class ResumeDraftResponse(BaseModel):
    draft: str
    job_id: str


# S3-011: Company Research Input and Prompt UX (backend half)
# Generates AI-assisted company research using job context + a
# user-provided question/focus area. Does not persist anything —
# S3-012's PUT /jobs/{job_id}/research-notes handles saving.
# Rules: S3-BR-002 (ownership)
class CompanyResearchRequest(BaseModel):
    user_context: str


class CompanyResearchResponse(BaseModel):
    research: str
    job_id: str


@router.post("/{job_id}/ai/resume", response_model=ResumeDraftResponse)
def generate_resume_draft(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an AI resume draft using profile and job context (S2-BR-019).

    Triggered by explicit user action (S2-BR-018).
    Output is returned for editing before save (S2-BR-020).
    """
    user_id = current_user.get("sub")

    # Fetch job and verify ownership
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Fetch user
    # Note: using raw SQL to avoid missing colum issue (desired salary min/max)
    # todo: switch back to sql model select(user) after sergios migration adds table
    # Fetch user profile using raw SQL to avoid missing column issues
    from sqlmodel import text

    result = db.exec(
        text(
            "SELECT id, email, first_name, last_name, "
            "phone_number, professional_summary "
            "FROM users WHERE id = :user_id"
        ).bindparams(user_id=user_id)
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    # Build profile context
    profile_context = f"""
Name: {result.first_name or ''} {result.last_name or ''}
Email: {result.email or ''}
Phone: {result.phone_number or 'Not provided'}
Professional Summary: {result.professional_summary or 'Not provided'}
""".strip()
    # user = db.exec(select(User).where(User.id == user_id)).first()
    # if not user:
    #    raise HTTPException(status_code=404, detail="User not found")

    # Build profile context
    # profile_context = f"""
    # Name: {user.first_name or ''} {user.last_name or ''}
    # Email: {user.email or ''}
    # Phone: {user.phone_number or 'Not provided'}
    # Professional Summary: {user.professional_summary or 'Not provided'}
    # """.strip()

    # Build job context
    job_context = f"""
Company: {job.company}
Job Title: {job.title}
Job Posting:
{job.job_posting_body}
""".strip()

    # Call Anthropic API
    import os

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Generate a professional resume draft tailored for the "
                    f"following job posting. Use the candidate's profile "
                    f"information to personalize it.\n\n"
                    f"CANDIDATE PROFILE:\n{profile_context}\n\n"
                    f"JOB DETAILS:\n{job_context}\n\n"
                    f"Generate a clean, professional resume in plain text format. "
                    f"Include sections for Summary, Experience (if available), "
                    f"Skills, and Education. "
                    f"Tailor the content to match the job requirements. "
                    f"If profile information is limited, create a strong "
                    f"template the candidate can fill in."
                ),
            }
        ],
    )

    draft = message.content[0].text

    return ResumeDraftResponse(draft=draft, job_id=job_id)


# S2-023: AI Rewrite/Improve Actions for Draft Content
# Takes an existing draft and returns an improved version
# Rules: S2-BR-018 (explicit user action), S2-BR-020 (output editable before save)


class RewriteRequest(BaseModel):
    draft: str
    instructions: str | None = None


class RewriteResponse(BaseModel):
    draft: str
    job_id: str


@router.post("/{job_id}/ai/rewrite", response_model=RewriteResponse)
def rewrite_draft(
    job_id: str,
    payload: RewriteRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rewrite/improve an existing draft using AI (S2-BR-018).

    Output is returned for editing before save (S2-BR-020).
    """
    user_id = current_user.get("sub")

    # Verify job exists and belongs to user
    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Build the rewrite prompt
    instructions_text = (
        f"\n\nSpecific instructions from the user: {payload.instructions}"
        if payload.instructions
        else ""
    )

    import os

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Please improve and rewrite the following resume/cover "
                    f"letter draft. Make it more professional, compelling, "
                    f"and well-structured.{instructions_text}\n\n"
                    f"EXISTING DRAFT:\n{payload.draft}"
                ),
            }
        ],
    )

    improved_draft = message.content[0].text

    return RewriteResponse(draft=improved_draft, job_id=job_id)


@router.post("/{job_id}/ai/company-research", response_model=CompanyResearchResponse)
def generate_company_research(
    job_id: str,
    payload: CompanyResearchRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate AI-assisted company research using job context and the
    user's specific question/focus (S3-BR-002 ownership enforced)."""
    user_id = current_user.get("sub")

    job = db.exec(select(Job).where(Job.id == job_id, Job.owner_id == user_id)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job_context = f"""
Company: {job.company}
Job Title: {job.title}
Job Posting:
{job.job_posting_body}
""".strip()

    import os

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Research the following company for a job applicant "
                    f"preparing to apply or interview. Use the job details "
                    f"and the candidate's specific focus to guide the "
                    f"research.\n\n"
                    f"JOB DETAILS:\n{job_context}\n\n"
                    f"CANDIDATE'S FOCUS:\n{payload.user_context}\n\n"
                    f"Provide a clear, well-organized summary covering "
                    f"relevant company information tailored to what the "
                    f"candidate asked about. Keep it concise and factual; "
                    f"note if you are uncertain about specific details."
                ),
            }
        ],
    )

    research = message.content[0].text

    return CompanyResearchResponse(research=research, job_id=job_id)
