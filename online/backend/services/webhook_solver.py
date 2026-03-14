"""Async background solver wrapper for webhook integrations."""
from __future__ import annotations
import asyncio
import httpx
import traceback
import json
from datetime import datetime

# You would normally import your actual engine solve method here.
# from solver.generator import generate_timetable
# But we will mock the duration to show the async nature in this Phase.


async def run_solver_background(job_id: str, school_id: int, webhook_url: str, payload_data: dict):
    """
    Run the OR-Tools solver in the background and dispatch the result to a webhook.
    """
    print(f"[Job {job_id}] Started background solving for school {school_id}")
    
    try:
        # Simulate long-running CPU task (the actual OR-Tools solver taking 5-30s)
        await asyncio.sleep(5)
        
        # Here we would normally call the core CP-SAT solver
        # schedule = generate_timetable(data=payload_data)
        
        # Mock successful result based on payload classes
        schedule = []
        for lesson in payload_data.get("lessons", []):
            for i in range(lesson.get("count", 1)):
                schedule.append({
                    "day": "Monday",
                    "period": i + 1,
                    "teacher_id": lesson.get("teacher_id"),
                    "subject_id": lesson.get("subject_id"),
                    "classroom_id": lesson.get("classroom_id"),
                })
        
        status = "success"
        result_data = schedule

    except Exception as e:
        print(f"[Job {job_id}] Solving failed: {e}")
        traceback.print_exc()
        status = "failed"
        result_data = {"error": str(e)}

    # Dispatch back to LMS Webhook
    dispatch_payload = {
        "job_id": job_id,
        "school_id": school_id,
        "status": status,
        "completed_at": datetime.utcnow().isoformat(),
        "schedule" if status == "success" else "error": result_data
    }

    print(f"[Job {job_id}] Dispatching result to {webhook_url}")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(webhook_url, json=dispatch_payload, timeout=10.0)
            resp.raise_for_status()
            print(f"[Job {job_id}] Webhook dispatch successful (Status {resp.status_code})")
    except Exception as e:
        print(f"[Job {job_id}] Webhook dispatch failed: {e}")
