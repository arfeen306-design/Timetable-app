"""Integration API: B2B webhook endpoints for LMS."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Optional

from backend.auth.deps import get_school_by_api_key
from backend.models.school import School
from backend.services.webhook_solver import run_solver_background

router = APIRouter()

class LessonPayload(BaseModel):
    subject_id: str
    teacher_id: str
    classroom_id: str
    count: int

class TeacherPayload(BaseModel):
    id: str
    name: str
    max_periods_per_week: int

class SubjectPayload(BaseModel):
    id: str
    name: str

class ClassroomPayload(BaseModel):
    id: str
    name: str

class SchoolDataPayload(BaseModel):
    days: List[str]
    periods: List[int]
    teachers: List[TeacherPayload]
    subjects: List[SubjectPayload]
    classrooms: List[ClassroomPayload]
    lessons: List[LessonPayload]
    
class WebhookSolveRequest(BaseModel):
    webhook_url: str
    data: SchoolDataPayload

@router.post("/webhook", status_code=202)
async def solve_timetable_webhook(
    request: WebhookSolveRequest,
    background_tasks: BackgroundTasks,
    school: School = Depends(get_school_by_api_key),
):
    """
    Accept timetable data from an LMS and generate the schedule asynchronously.
    Responds immediately with a job ID and triggers solving in the background.
    """
    if not request.webhook_url:
        raise HTTPException(status_code=400, detail="webhook_url is required")
        
    job_id = str(uuid.uuid4())
    
    # Offload the heavy CPU operations (OR-Tools solver) and webhook dispatch to the background
    background_tasks.add_task(
        run_solver_background,
        job_id=job_id,
        school_id=school.id,
        webhook_url=request.webhook_url,
        payload_data=request.data.dict()
    )
    
    return {
        "job_id": job_id,
        "status": "accepted",
        "message": f"Timetable generation job '{job_id}' started. Results will be sent to {request.webhook_url}"
    }
