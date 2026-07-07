import os
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User


class UserSyncPayload(BaseModel):
    email: str
    first_name: str
    last_name: str


router = APIRouter(prefix="/auth", tags=["auth"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
PROFILE_PHOTO_BUCKET = "profile-photos"
ALLOWED_PROFILE_PHOTO_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024


class UserProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone_number: Optional[str] = None
    professional_summary: Optional[str] = None


class ProfilePhotoResponse(BaseModel):
    profile_photo_path: Optional[str] = None
    profile_photo_url: Optional[str] = None


def require_supabase_config():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase storage is not configured",
        )


async def create_signed_profile_photo_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None

    require_supabase_config()

    async with httpx.AsyncClient() as client:
        sign_response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{PROFILE_PHOTO_BUCKET}/{path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            },
            json={"expiresIn": 3600},
        )

    if sign_response.status_code not in (200, 201):
        raise HTTPException(
            status_code=500,
            detail=f"Profile photo sign failed: {sign_response.text}",
        )

    sign_data = sign_response.json()
    signed_path = sign_data.get("signedURL") or sign_data.get("signedUrl", "")
    return f"{SUPABASE_URL}/storage/v1{signed_path}" if signed_path else None


@router.post("/sync")
def sync_user(
    payload: UserSyncPayload,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)

    if user is None:
        user = User(
            id=user_id,
            email=payload.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        db.add(user)
    else:
        user.email = payload.email
        user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)
    return {"user_id": user.id, "email": user.email}


# S1-010: User Self-Registration (sync)
# On first authenticated request, create a users row if one doesn't exist
# for this Clerk user_id. Subsequent requests just return the existing record.
@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    email = current_user.get("email")

    user = db.exec(select(User).where(User.id == user_id)).first()

    if not user:
        user = User(id=user_id, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "user_id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    return {
        "message": "Logged out successfully",
        "user_id": current_user.get("sub"),
    }


@router.get("/profile")
def get_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/profile")
def update_profile(
    payload: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        user = User(
            id=user_id,
            email=payload.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        db.add(user)
    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.email = payload.email
    user.phone_number = payload.phone_number
    user.professional_summary = payload.professional_summary
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


@router.get("/profile/photo", response_model=ProfilePhotoResponse)
async def get_profile_photo(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # current_user["sub"] maps to users.id in the database.
    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return ProfilePhotoResponse(
        profile_photo_path=user.profile_photo_path,
        profile_photo_url=await create_signed_profile_photo_url(
            user.profile_photo_path
        ),
    )


@router.post("/profile/photo", response_model=ProfilePhotoResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_supabase_config()

    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if file.content_type not in ALLOWED_PROFILE_PHOTO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Profile photo must be a PNG, JPG, or WEBP image",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Profile photo must be under 2 MB",
        )

    extension_by_type = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
    }
    extension = extension_by_type[file.content_type]
    path = f"{user_id}/profile-photo.{extension}"

    async with httpx.AsyncClient() as client:
        upload_response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{PROFILE_PHOTO_BUCKET}/{path}",
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
            detail=f"Profile photo upload failed: {upload_response.text}",
        )

    user.profile_photo_path = path
    user.updated_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)

    return ProfilePhotoResponse(
        profile_photo_path=user.profile_photo_path,
        profile_photo_url=await create_signed_profile_photo_url(
            user.profile_photo_path
        ),
    )


@router.delete("/profile/photo", response_model=ProfilePhotoResponse)
async def delete_profile_photo(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_supabase_config()

    user_id = current_user.get("sub")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    path = user.profile_photo_path
    if path:
        async with httpx.AsyncClient() as client:
            await client.request(
                "DELETE",
                f"{SUPABASE_URL}/storage/v1/object/{PROFILE_PHOTO_BUCKET}",
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                json={"prefixes": [path]},
            )

    user.profile_photo_path = None
    user.updated_at = datetime.utcnow()
    db.add(user)
    db.commit()

    return ProfilePhotoResponse()
