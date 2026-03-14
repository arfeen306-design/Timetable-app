"""Test subjects API: list and create (project-scoped)."""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from backend.models.project import Project


def test_list_subjects_requires_project_in_own_school(
    client: TestClient, user_with_school, school, db
):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    login = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    token = login.json()["access_token"]
    r = client.get(
        f"/api/projects/{p.id}/subjects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json() == []


def test_create_subject_and_list(
    client: TestClient, user_with_school, school, db
):
    p = Project(school_id=school.id, name="P", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    login = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    token = login.json()["access_token"]
    create = client.post(
        f"/api/projects/{p.id}/subjects",
        json={"name": "Mathematics", "code": "MATH", "category": "Core"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200
    data = create.json()
    assert data["name"] == "Mathematics"
    assert data["project_id"] == p.id
    list_r = client.get(
        f"/api/projects/{p.id}/subjects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_r.status_code == 200
    assert len(list_r.json()) == 1
    assert list_r.json()[0]["name"] == "Mathematics"
