from fastapi import APIRouter, Depends

from app.dependencies import get_current_user

router = APIRouter(prefix="/protected", tags=["protected"])


# S1-014: Route Protection
# Any route that requires authentication must use Depends(get_current_user).
# Unauthenticated requests will receive 401 Unauthorized per S1-003 guardrails.
@router.get("/ping")
def protected_ping(current_user: dict = Depends(get_current_user)):
    return {
        "message": "You are authenticated",
        "user_id": current_user.get("sub"),
    }
