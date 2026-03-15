"""Tests for bulk-delete endpoints (teachers and classes)."""
from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient

from backend.models.project import Project
from backend.models.teacher_model import Teacher
from backend.models.class_model import SchoolClass


def _login(client: TestClient, email: str = "user@test.school", password: str = "pass123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def _delete_bulk(client: TestClient, url: str, ids: list[int], token: str):
    """Helper: DELETE with JSON body via client.request() for httpx compat."""
    return client.request(
        "DELETE",
        url,
        json={"ids": ids},
        headers={"Authorization": f"Bearer {token}"},
    )


# ─── Teachers ────────────────────────────────────────────────────────────────

def test_bulk_delete_teachers_happy_path(client, user_with_school, school, db):
    """Deletes selected teachers and leaves others intact."""
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)

    t1 = Teacher(project_id=p.id, first_name="Alice")
    t2 = Teacher(project_id=p.id, first_name="Bob")
    t3 = Teacher(project_id=p.id, first_name="Carol")
    db.add_all([t1, t2, t3])
    db.commit()
    db.refresh(t1)
    db.refresh(t2)
    db.refresh(t3)

    token = _login(client)
    r = _delete_bulk(client, f"/api/projects/{p.id}/teachers/bulk", [t1.id, t2.id], token)
    assert r.status_code == 200
    data = r.json()
    assert data["deleted"] == 2
    assert data["failed"] == []

    # t3 should still exist; t1 and t2 should be gone
    db.expire_all()
    assert db.query(Teacher).filter_by(id=t3.id).first() is not None
    assert db.query(Teacher).filter_by(id=t1.id).first() is None
    assert db.query(Teacher).filter_by(id=t2.id).first() is None


def test_bulk_delete_teachers_foreign_ids_returns_403(
    client, user_with_school, school, other_school_and_user, db
):
    """Returns 403 when any id belongs to a different project."""
    other_school, _ = other_school_and_user

    my_project = Project(school_id=school.id, name="Mine", academic_year="2024")
    other_project = Project(school_id=other_school.id, name="Other", academic_year="2024")
    db.add_all([my_project, other_project])
    db.commit()
    db.refresh(my_project)
    db.refresh(other_project)

    foreign_teacher = Teacher(project_id=other_project.id, first_name="Evil")
    db.add(foreign_teacher)
    db.commit()
    db.refresh(foreign_teacher)

    token = _login(client)
    r = _delete_bulk(client, f"/api/projects/{my_project.id}/teachers/bulk", [foreign_teacher.id], token)
    assert r.status_code == 403


def test_bulk_delete_teachers_empty_ids(client, user_with_school, school, db):
    """Empty ids list returns deleted=0 without error."""
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)

    token = _login(client)
    r = _delete_bulk(client, f"/api/projects/{p.id}/teachers/bulk", [], token)
    assert r.status_code == 200
    assert r.json()["deleted"] == 0
    assert r.json()["failed"] == []


def test_bulk_delete_teachers_nonexistent_ids_in_failed(client, user_with_school, school, db):
    """IDs that do not exist in any project end up in the failed list."""
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)

    t = Teacher(project_id=p.id, first_name="Real")
    db.add(t)
    db.commit()
    db.refresh(t)

    token = _login(client)
    r = _delete_bulk(client, f"/api/projects/{p.id}/teachers/bulk", [t.id, 99999], token)
    assert r.status_code == 200
    data = r.json()
    assert data["deleted"] == 1
    assert 99999 in data["failed"]


# ─── Classes ─────────────────────────────────────────────────────────────────

def test_bulk_delete_classes_happy_path(client, user_with_school, school, db):
    """Deletes selected classes and leaves others intact."""
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)

    c1 = SchoolClass(project_id=p.id, grade="10", name="10A")
    c2 = SchoolClass(project_id=p.id, grade="10", name="10B")
    c3 = SchoolClass(project_id=p.id, grade="11", name="11A")
    db.add_all([c1, c2, c3])
    db.commit()
    db.refresh(c1)
    db.refresh(c2)
    db.refresh(c3)

    token = _login(client)
    r = _delete_bulk(client, f"/api/projects/{p.id}/classes/bulk", [c1.id, c2.id], token)
    assert r.status_code == 200
    data = r.json()
    assert data["deleted"] == 2
    assert data["failed"] == []

    db.expire_all()
    assert db.query(SchoolClass).filter_by(id=c3.id).first() is not None
    assert db.query(SchoolClass).filter_by(id=c1.id).first() is None
    assert db.query(SchoolClass).filter_by(id=c2.id).first() is None


def test_bulk_delete_classes_foreign_ids_returns_403(
    client, user_with_school, school, other_school_and_user, db
):
    """Returns 403 when any id belongs to a different project."""
    other_school, _ = other_school_and_user

    my_project = Project(school_id=school.id, name="Mine", academic_year="2024")
    other_project = Project(school_id=other_school.id, name="Other", academic_year="2024")
    db.add_all([my_project, other_project])
    db.commit()
    db.refresh(my_project)
    db.refresh(other_project)

    foreign_class = SchoolClass(project_id=other_project.id, grade="9", name="9X")
    db.add(foreign_class)
    db.commit()
    db.refresh(foreign_class)

    token = _login(client)
    r = _delete_bulk(client, f"/api/projects/{my_project.id}/classes/bulk", [foreign_class.id], token)
    assert r.status_code == 403
