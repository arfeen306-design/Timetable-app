import httpx
import json

URL = "http://localhost:8000/api/solve/webhook"
API_KEY = "test_key_123"

payload = {
    "webhook_url": "https://webhook.site/mock-url",
    "data": {
        "days": ["Monday"],
        "periods": [1, 2],
        "teachers": [{"id": "t1", "name": "Test Teacher", "max_periods_per_week": 5}],
        "subjects": [{"id": "s1", "name": "Test Subject"}],
        "classrooms": [{"id": "c1", "name": "Test Room"}],
        "lessons": [
            {
                "subject_id": "s1",
                "teacher_id": "t1",
                "classroom_id": "c1",
                "count": 2
            }
        ]
    }
}

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

with httpx.Client() as client:
    resp = client.post(URL, json=payload, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
