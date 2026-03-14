"""Test auth: login and me."""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient


def test_login_fails_without_credentials(client: TestClient):
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 400


def test_login_fails_invalid_password(client: TestClient, user_with_school):
    r = client.post("/api/auth/login", json={"email": "user@test.school", "password": "wrong"})
    assert r.status_code == 401


def test_login_success_returns_token(client: TestClient, user_with_school):
    r = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "user@test.school"
    assert data["user"]["school_id"] is not None


def test_me_requires_auth(client: TestClient):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_returns_user_with_token(client: TestClient, user_with_school):
    login = client.post("/api/auth/login", json={"email": "user@test.school", "password": "pass123"})
    token = login.json()["access_token"]
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "user@test.school"
    assert r.json()["school_id"] is not None
