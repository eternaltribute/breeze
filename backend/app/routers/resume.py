import os
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Resume

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
