"""Tasks CRUD — to-do items for the dashboard."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.task_model import Task

router = APIRouter()


class TaskCreate(BaseModel):
    title: str
    due_date: Optional[str] = None
    priority: str = "medium"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None


@router.get("")
def list_tasks(
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "due_date": t.due_date,
            "priority": t.priority,
            "completed": t.completed,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tasks
    ]


@router.post("")
def create_task(
    data: TaskCreate,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    task = Task(
        project_id=project_id,
        title=data.title,
        due_date=data.due_date,
        priority=data.priority,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {
        "id": task.id,
        "title": task.title,
        "due_date": task.due_date,
        "priority": task.priority,
        "completed": task.completed,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


@router.patch("/{task_id}")
def update_task(
    task_id: int,
    data: TaskUpdate,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        from fastapi import HTTPException
        raise HTTPException(404, "Task not found")
    if data.title is not None:
        task.title = data.title
    if data.due_date is not None:
        task.due_date = data.due_date
    if data.priority is not None:
        task.priority = data.priority
    if data.completed is not None:
        task.completed = data.completed
    db.commit()
    db.refresh(task)
    return {
        "id": task.id,
        "title": task.title,
        "due_date": task.due_date,
        "priority": task.priority,
        "completed": task.completed,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    project_id: int = Path(...),
    project=Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        from fastapi import HTTPException
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"ok": True}
