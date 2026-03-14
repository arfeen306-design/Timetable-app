"""Phase 2 CRUD and cross-school protection tests."""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from backend.models.project import Project
from backend.models.class_model import SchoolClass
from backend.models.room_model import Room
from backend.models.teacher_model import Teacher
from backend.models.project import Subject
from backend.models.lesson_model import Lesson


def _login(client: TestClient, email: str = "user@test.school", password: str = "pass123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_school_settings_get_create(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    token = _login(client)
    r = client.get(
        f"/api/projects/{p.id}/school-settings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["project_id"] == p.id
    assert "days_per_week" in data
    put_r = client.put(
        f"/api/projects/{p.id}/school-settings",
        json={"name": "My School", "days_per_week": 6, "periods_per_day": 8},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_r.status_code == 200
    assert put_r.json()["name"] == "My School"
    assert put_r.json()["days_per_week"] == 6


def test_school_settings_404_for_other_school(client: TestClient, user_with_school, school, other_school_and_user, db):
    other_school, _ = other_school_and_user
    p = Project(school_id=other_school.id, name="Other", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    token = _login(client)
    r = client.get(
        f"/api/projects/{p.id}/school-settings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404


def test_classes_full_crud(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    token = _login(client)
    create = client.post(
        f"/api/projects/{p.id}/classes",
        json={"grade": "10", "section": "A", "name": "10A", "strength": 35},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200
    cid = create.json()["id"]
    get_r = client.get(f"/api/projects/{p.id}/classes/{cid}", headers={"Authorization": f"Bearer {token}"})
    assert get_r.status_code == 200
    assert get_r.json()["name"] == "10A"
    patch_r = client.patch(
        f"/api/projects/{p.id}/classes/{cid}",
        json={"strength": 40},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_r.status_code == 200
    assert patch_r.json()["strength"] == 40
    list_r = client.get(f"/api/projects/{p.id}/classes", headers={"Authorization": f"Bearer {token}"})
    assert list_r.status_code == 200
    assert len(list_r.json()) == 1
    del_r = client.delete(f"/api/projects/{p.id}/classes/{cid}", headers={"Authorization": f"Bearer {token}"})
    assert del_r.status_code == 204
    get_after = client.get(f"/api/projects/{p.id}/classes/{cid}", headers={"Authorization": f"Bearer {token}"})
    assert get_after.status_code == 404


def test_rooms_full_crud(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    token = _login(client)
    create = client.post(
        f"/api/projects/{p.id}/rooms",
        json={"name": "Room 101", "room_type": "Lab", "capacity": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200
    rid = create.json()["id"]
    get_r = client.get(f"/api/projects/{p.id}/rooms/{rid}", headers={"Authorization": f"Bearer {token}"})
    assert get_r.status_code == 200
    assert get_r.json()["name"] == "Room 101"
    del_r = client.delete(f"/api/projects/{p.id}/rooms/{rid}", headers={"Authorization": f"Bearer {token}"})
    assert del_r.status_code == 204


def test_teachers_full_crud_and_subjects(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    subj = Subject(project_id=p.id, name="Math", code="M")
    db.add(subj)
    db.commit()
    db.refresh(subj)
    token = _login(client)
    create = client.post(
        f"/api/projects/{p.id}/teachers",
        json={"first_name": "John", "last_name": "Doe", "code": "JD"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200
    tid = create.json()["id"]
    put_subjects = client.put(
        f"/api/projects/{p.id}/teachers/{tid}/subjects",
        json={"subject_ids": [subj.id]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_subjects.status_code == 204
    get_subjects = client.get(
        f"/api/projects/{p.id}/teachers/{tid}/subjects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_subjects.status_code == 200
    assert get_subjects.json() == [subj.id]


def test_lessons_full_crud(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    subj = Subject(project_id=p.id, name="Math", code="M")
    t = Teacher(project_id=p.id, first_name="T", last_name="1")
    c = SchoolClass(project_id=p.id, grade="10", name="10A")
    r = Room(project_id=p.id, name="R1")
    db.add_all([subj, t, c, r])
    db.commit()
    for x in [subj, t, c, r]:
        db.refresh(x)
    token = _login(client)
    create = client.post(
        f"/api/projects/{p.id}/lessons",
        json={
            "teacher_id": t.id,
            "subject_id": subj.id,
            "class_id": c.id,
            "periods_per_week": 5,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200
    assert create.json()["periods_per_week"] == 5
    lid = create.json()["id"]
    list_r = client.get(f"/api/projects/{p.id}/lessons", headers={"Authorization": f"Bearer {token}"})
    assert list_r.status_code == 200
    assert len(list_r.json()) == 1
    client.delete(f"/api/projects/{p.id}/lessons/{lid}", headers={"Authorization": f"Bearer {token}"})
    assert client.get(f"/api/projects/{p.id}/lessons/{lid}", headers={"Authorization": f"Bearer {token}"}).status_code == 404


def test_constraints_full_crud(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    t = Teacher(project_id=p.id, first_name="T", last_name="1")
    db.add(t)
    db.commit()
    db.refresh(t)
    token = _login(client)
    create = client.post(
        f"/api/projects/{p.id}/constraints",
        json={
            "entity_type": "teacher",
            "entity_id": t.id,
            "day_index": 0,
            "period_index": 0,
            "constraint_type": "unavailable",
            "is_hard": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200
    cid = create.json()["id"]
    list_r = client.get(f"/api/projects/{p.id}/constraints", headers={"Authorization": f"Bearer {token}"})
    assert list_r.status_code == 200
    assert len(list_r.json()) >= 1
    client.delete(f"/api/projects/{p.id}/constraints/{cid}", headers={"Authorization": f"Bearer {token}"})
    assert client.get(f"/api/projects/{p.id}/constraints/{cid}", headers={"Authorization": f"Bearer {token}"}).status_code == 404


def test_subject_get_patch_delete(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    subj = Subject(project_id=p.id, name="Math", code="M")
    db.add(subj)
    db.commit()
    db.refresh(subj)
    token = _login(client)
    get_r = client.get(f"/api/projects/{p.id}/subjects/{subj.id}", headers={"Authorization": f"Bearer {token}"})
    assert get_r.status_code == 200
    assert get_r.json()["name"] == "Math"
    patch_r = client.patch(
        f"/api/projects/{p.id}/subjects/{subj.id}",
        json={"name": "Mathematics"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_r.status_code == 200
    assert patch_r.json()["name"] == "Mathematics"
    del_r = client.delete(f"/api/projects/{p.id}/subjects/{subj.id}", headers={"Authorization": f"Bearer {token}"})
    assert del_r.status_code == 204
    assert client.get(f"/api/projects/{p.id}/subjects/{subj.id}", headers={"Authorization": f"Bearer {token}"}).status_code == 404
