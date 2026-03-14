"""Test project access protection: one school cannot access another school's project."""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from backend.models.project import Project


def test_get_project_returns_404_for_other_schools_project(
    client: TestClient, user_with_school, school, other_school_and_user, db
):
    other_school, other_user = other_school_and_user
    # Create a project belonging to other_school
    p = Project(school_id=other_school.id, name="Other Project", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    project_id = p.id
    # Log in as user_with_school (different school)
    login = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    token = login.json()["access_token"]
    # Try to get the other school's project
    r = client.get(f"/api/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404
    assert "not found" in r.json()["detail"].lower()


def test_get_project_succeeds_for_own_school(client: TestClient, user_with_school, school, db):
    p = Project(school_id=school.id, name="Own Project", academic_year="2024")
    db.add(p)
    db.commit()
    db.refresh(p)
    login = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    token = login.json()["access_token"]
    r = client.get(f"/api/projects/{p.id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["name"] == "Own Project"
