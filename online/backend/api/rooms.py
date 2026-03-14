"""Rooms API — full CRUD, project-scoped."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.auth.project_scope import get_project_or_404
from backend.models.base import get_db
from backend.models.project import Project
from backend.repositories.room_repo import (
    list_by_project,
    get_by_id_and_project,
    create as create_room,
    update as update_room,
    delete as delete_room,
)

router = APIRouter()


class RoomCreate(BaseModel):
    name: str
    code: str = ""
    room_type: str = "Classroom"
    capacity: int = 40
    color: str = "#9B59B6"
    home_class_id: Optional[int] = None


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    color: Optional[str] = None
    home_class_id: Optional[int] = None


class RoomResponse(BaseModel):
    id: int
    project_id: int
    name: str
    code: str
    room_type: str
    capacity: int
    color: str
    home_class_id: Optional[int] = None

    class Config:
        from_attributes = True


@router.get("", response_model=list[RoomResponse])
def list_rooms(
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    items = list_by_project(db, project.id)
    return [RoomResponse.model_validate(r) for r in items]


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    r = get_by_id_and_project(db, room_id, project.id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    return RoomResponse.model_validate(r)


@router.post("", response_model=RoomResponse)
def create_room_endpoint(
    data: RoomCreate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    r = create_room(
        db,
        project_id=project.id,
        name=data.name,
        code=data.code,
        room_type=data.room_type,
        capacity=data.capacity,
        color=data.color,
        home_class_id=data.home_class_id,
    )
    return RoomResponse.model_validate(r)


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room_endpoint(
    room_id: int,
    data: RoomUpdate,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    r = update_room(db, room_id, project.id, **data.model_dump(exclude_unset=True))
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    return RoomResponse.model_validate(r)


@router.delete("/{room_id}", status_code=204)
def delete_room_endpoint(
    room_id: int,
    project: Project = Depends(get_project_or_404),
    db: Session = Depends(get_db),
):
    if not delete_room(db, room_id, project.id):
        raise HTTPException(status_code=404, detail="Room not found")
