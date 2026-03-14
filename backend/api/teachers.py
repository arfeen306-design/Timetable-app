"""Teachers API — full CRUD + teacher subjects, bulk, Excel import, project-scoped."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories import teacher_repo
from backend.services.excel_import_service import import_teachers_from_excel, ImportResult, RowError

router = APIRouter()


class TeacherCreate(BaseModel):
    first_name: str
    last_name: str = ""
    code: str = ""
    title: str = "Mr."
    color: str = "#E8725A"
    max_periods_day: int = 6
    max_periods_week: int = 30
    email: str = ""
    whatsapp_number: str = ""


class TeacherUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    code: Optional[str] = None
    title: Optional[str] = None
    color: Optional[str] = None
    max_periods_day: Optional[int] = None
    max_periods_week: Optional[int] = None
    email: Optional[str] = None
    whatsapp_number: Optional[str] = None


class TeacherResponse(BaseModel):
    id: int
    project_id: int
    first_name: str
    last_name: str
    code: str
    title: str
    color: str
    max_periods_day: int
    max_periods_week: int
    email: str
    whatsapp_number: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[TeacherResponse])
def list_teachers(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    items = teacher_repo.list_by_project(db, project.id)
    return [TeacherResponse.model_validate(t) for t in items]


class TeacherBulkCreate(BaseModel):
    items: List[TeacherCreate]


class BulkResult(BaseModel):
    created: int
    errors: List[dict]  # [{ "row": int, "message": str }]


@router.post("/bulk", response_model=BulkResult)
def bulk_create_teachers(
    data: TeacherBulkCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    created = 0
    errors: List[dict] = []
    for i, item in enumerate(data.items):
        if teacher_repo.find_by_name(db, project.id, item.first_name, item.last_name):
            errors.append({"row": i + 1, "message": "A teacher with this name already exists."})
            continue
        try:
            teacher_repo.create(
                db,
                project_id=project.id,
                first_name=item.first_name,
                last_name=item.last_name,
                code=item.code,
                title=item.title,
                color=item.color,
                max_periods_day=item.max_periods_day,
                max_periods_week=item.max_periods_week,
                email=item.email,
                whatsapp_number=item.whatsapp_number,
            )
            created += 1
        except Exception as e:
            errors.append({"row": i + 1, "message": str(e)})
    return BulkResult(created=created, errors=errors)


class ImportExcelResult(BaseModel):
    success_count: int
    total_rows: int
    errors: List[dict]  # [{ "row": int, "message": str }]


@router.post("/import-excel", response_model=ImportExcelResult)
async def import_teachers_excel(
    file: UploadFile = File(...),
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Upload an Excel file (.xlsx).")
    content = await file.read()
    result: ImportResult = import_teachers_from_excel(db, project.id, content)
    return ImportExcelResult(
        success_count=result.success_count,
        total_rows=result.total_rows,
        errors=[{"row": e.row, "message": e.message} for e in result.errors],
    )


@router.get("/{teacher_id}", response_model=TeacherResponse)
def get_teacher(
    teacher_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    t = teacher_repo.get_by_id_and_project(db, teacher_id, project.id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return TeacherResponse.model_validate(t)


@router.post("", response_model=TeacherResponse)
def create_teacher_endpoint(
    data: TeacherCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    t = teacher_repo.create(
        db,
        project_id=project.id,
        first_name=data.first_name,
        last_name=data.last_name,
        code=data.code,
        title=data.title,
        color=data.color,
        max_periods_day=data.max_periods_day,
        max_periods_week=data.max_periods_week,
        email=data.email,
        whatsapp_number=data.whatsapp_number,
    )
    return TeacherResponse.model_validate(t)


@router.patch("/{teacher_id}", response_model=TeacherResponse)
def update_teacher_endpoint(
    teacher_id: int,
    data: TeacherUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    t = teacher_repo.update(db, teacher_id, project.id, **data.model_dump(exclude_unset=True))
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return TeacherResponse.model_validate(t)


@router.delete("/{teacher_id}", status_code=204)
def delete_teacher_endpoint(
    teacher_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not teacher_repo.delete(db, teacher_id, project.id):
        raise HTTPException(status_code=404, detail="Teacher not found")


# Teacher subjects
@router.get("/{teacher_id}/subjects", response_model=List[int])
def get_teacher_subjects(
    teacher_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    t = teacher_repo.get_by_id_and_project(db, teacher_id, project.id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return teacher_repo.get_subject_ids_for_teacher(db, teacher_id)


class TeacherSubjectsUpdate(BaseModel):
    subject_ids: List[int]


@router.put("/{teacher_id}/subjects", status_code=204)
def set_teacher_subjects_endpoint(
    teacher_id: int,
    data: TeacherSubjectsUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    t = teacher_repo.get_by_id_and_project(db, teacher_id, project.id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    teacher_repo.set_teacher_subjects(db, teacher_id, data.subject_ids)
