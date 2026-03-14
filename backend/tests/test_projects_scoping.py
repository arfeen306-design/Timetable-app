"""Test school-scoped project listing."""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from backend.models.project import Project


def test_list_projects_requires_auth(client: TestClient, db):
    r = client.get("/api/projects")
    assert r.status_code == 401


def test_list_projects_returns_only_current_school_projects(
    client: TestClient, user_with_school, school, db
):
    p = Project(school_id=school.id, name="My Project", academic_year="2024")
    db.add(p)
    db.commit()
    login = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    token = login.json()["access_token"]
    r = client.get("/api/projects", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["name"] == "My Project"
    assert data[0]["school_id"] == school.id


def test_create_project_belongs_to_current_school(client: TestClient, user_with_school, school):
    login = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    token = login.json()["access_token"]
    r = client.post(
        "/api/projects",
        json={"name": "New One", "academic_year": "2025"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New One"
    assert r.json()["school_id"] == school.id
