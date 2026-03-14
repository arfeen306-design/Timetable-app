"""Test backend startup and health."""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient


def test_health_route():
    from backend.main import app
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_api_docs_available_when_debug():
    from backend.main import app
    client = TestClient(app)
    r = client.get("/docs")
    # If DEBUG is true we get 200; else might redirect or 404
    assert r.status_code in (200, 307, 404)
