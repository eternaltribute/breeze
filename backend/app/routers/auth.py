from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


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
