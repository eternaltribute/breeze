from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


# S1-015: Per-User Data Authorization
# All job records must be filtered by the authenticated user's Clerk user_id.
# Cross-user access must be denied per S1-BR-006, S1-BR-007, S1-BR-008.
# TODO: Wire up to database once Sergio's models are in place.
MOCK_JOBS = {
    "user_123": [{"id": "1", "title": "Software Engineer", "company": "Acme"}],
    "user_456": [{"id": "2", "title": "Product Manager", "company": "Globex"}],
}


@router.get("/")
def get_jobs(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    return MOCK_JOBS.get(user_id, [])


@router.get("/{job_id}")
def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    user_jobs = MOCK_JOBS.get(user_id, [])
    job = next((j for j in user_jobs if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
