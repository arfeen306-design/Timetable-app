"""Classes API — full CRUD, bulk, Excel import, project-scoped."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.models.class_model import SchoolClass
from backend.repositories import class_repo
from backend.services.excel_import_service import import_classes_from_excel, ImportResult

router = APIRouter()


class ClassCreate(BaseModel):
    grade: str
    section: str = ""
    stream: str = ""
    name: str = ""
    code: str = ""
    color: str = "#50C878"
    class_teacher_id: Optional[int] = None
    home_room_id: Optional[int] = None
    strength: int = 30


class ClassUpdate(BaseModel):
    grade: Optional[str] = None
    section: Optional[str] = None
    stream: Optional[str] = None
    name: Optional[str] = None
    code: Optional[str] = None
    color: Optional[str] = None
    class_teacher_id: Optional[int] = None
    home_room_id: Optional[int] = None
    strength: Optional[int] = None


class ClassResponse(BaseModel):
    id: int
    project_id: int
    grade: str
    section: str
    stream: str
    name: str
    code: str
    color: str
    class_teacher_id: Optional[int] = None
    home_room_id: Optional[int] = None
    strength: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[ClassResponse])
def list_classes(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    items = class_repo.list_by_project(db, project.id)
    return [ClassResponse.model_validate(c) for c in items]


class ClassBulkCreate(BaseModel):
    items: List[ClassCreate]


class BulkResult(BaseModel):
    created: int
    errors: List[dict]


class BulkDeleteRequest(BaseModel):
    ids: List[int]


class BulkDeleteResult(BaseModel):
    deleted: int
    failed: List[int]


@router.post("/bulk", response_model=BulkResult)
def bulk_create_classes(
    data: ClassBulkCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    created = 0
    errors: List[dict] = []
    for i, item in enumerate(data.items):
        if class_repo.find_by_grade_section_stream(
            db, project.id, item.grade, item.section, item.stream
        ):
            errors.append({"row": i + 1, "message": "A class with this grade/section/stream already exists."})
            continue
        try:
            name = item.name or f"{item.grade}{item.section or ''}".strip() or "Class"
            class_repo.create(
                db,
                project_id=project.id,
                grade=item.grade,
                section=item.section,
                stream=item.stream,
                name=name,
                code=item.code,
                color=item.color,
                strength=item.strength,
            )
            created += 1
        except Exception as e:
            errors.append({"row": i + 1, "message": str(e)})
    return BulkResult(created=created, errors=errors)


@router.delete("/bulk", response_model=BulkDeleteResult)
def bulk_delete_classes(
    data: BulkDeleteRequest,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not data.ids:
        return BulkDeleteResult(deleted=0, failed=[])
    # Security: 403 if any id belongs to a different project
    foreign = (
        db.query(SchoolClass)
        .filter(SchoolClass.id.in_(data.ids), SchoolClass.project_id != project.id)
        .first()
    )
    if foreign:
        raise HTTPException(status_code=403, detail="One or more IDs do not belong to this project")
    # Fetch only records that exist in this project
    to_delete = (
        db.query(SchoolClass)
        .filter(SchoolClass.id.in_(data.ids), SchoolClass.project_id == project.id)
        .all()
    )
    deleted_ids = {c.id for c in to_delete}
    failed = [cid for cid in data.ids if cid not in deleted_ids]
    try:
        for c in to_delete:
            db.delete(c)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Bulk delete failed")
    return BulkDeleteResult(deleted=len(to_delete), failed=failed)


class ImportExcelResult(BaseModel):
    success_count: int
    total_rows: int
    errors: List[dict]


@router.post("/import-excel", response_model=ImportExcelResult)
async def import_classes_excel(
    file: UploadFile = File(...),
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Upload an Excel file (.xlsx).")
    content = await file.read()
    result: ImportResult = import_classes_from_excel(db, project.id, content)
    return ImportExcelResult(
        success_count=result.success_count,
        total_rows=result.total_rows,
        errors=[{"row": e.row, "message": e.message} for e in result.errors],
    )


@router.get("/{class_id}", response_model=ClassResponse)
def get_class(
    class_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = class_repo.get_by_id_and_project(db, class_id, project.id)
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    return ClassResponse.model_validate(c)


@router.post("", response_model=ClassResponse)
def create_class_endpoint(
    data: ClassCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = class_repo.create(
        db,
        project_id=project.id,
        grade=data.grade,
        section=data.section,
        stream=data.stream,
        name=data.name,
        code=data.code,
        color=data.color,
        class_teacher_id=data.class_teacher_id,
        home_room_id=data.home_room_id,
        strength=data.strength,
    )
    return ClassResponse.model_validate(c)


@router.patch("/{class_id}", response_model=ClassResponse)
def update_class_endpoint(
    class_id: int,
    data: ClassUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    c = class_repo.update(db, class_id, project.id, **data.model_dump(exclude_unset=True))
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    return ClassResponse.model_validate(c)


@router.delete("/{class_id}", status_code=204)
def delete_class_endpoint(
    class_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not class_repo.delete(db, class_id, project.id):
        raise HTTPException(status_code=404, detail="Class not found")
