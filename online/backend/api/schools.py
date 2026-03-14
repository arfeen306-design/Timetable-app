"""Schools API — skeleton for Phase 2 (get/update school profile)."""
from fastapi import APIRouter, Depends
from backend.auth.deps import get_current_user

router = APIRouter()


@router.get("/me")
def get_my_school(current_user: dict = Depends(get_current_user)):
    """TODO Phase 2: Return current user's school profile."""
    return {"message": "TODO Phase 2", "school_id": current_user.get("school_id")}
