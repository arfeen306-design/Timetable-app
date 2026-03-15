"""API router aggregation."""
from fastapi import APIRouter
from backend.api import auth, projects, subjects, schools, school_settings, classes, teachers, rooms, lessons, constraints, generation, review, exports, templates, integration, move_entry, workload, substitutions, academic_year, dashboard

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(schools.router, prefix="/schools", tags=["schools"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(school_settings.router, prefix="/projects/{project_id}/school-settings", tags=["school-settings"])
api_router.include_router(subjects.router, prefix="/projects/{project_id}/subjects", tags=["subjects"])
api_router.include_router(classes.router, prefix="/projects/{project_id}/classes", tags=["classes"])
api_router.include_router(teachers.router, prefix="/projects/{project_id}/teachers", tags=["teachers"])
api_router.include_router(rooms.router, prefix="/projects/{project_id}/rooms", tags=["rooms"])
api_router.include_router(lessons.router, prefix="/projects/{project_id}/lessons", tags=["lessons"])
api_router.include_router(constraints.router, prefix="/projects/{project_id}/constraints", tags=["constraints"])
api_router.include_router(generation.router, prefix="/projects/{project_id}/generate", tags=["generation"])
api_router.include_router(review.router, prefix="/projects/{project_id}/review", tags=["review"])
api_router.include_router(move_entry.router, prefix="/projects/{project_id}/review", tags=["review"])
api_router.include_router(exports.router, prefix="/projects/{project_id}/exports", tags=["exports"])
api_router.include_router(workload.router, prefix="/projects/{project_id}/workload", tags=["workload"])
api_router.include_router(substitutions.router, prefix="/projects/{project_id}/substitutions", tags=["substitutions"])
api_router.include_router(academic_year.router, prefix="/projects/{project_id}/academic-year", tags=["academic-year"])
api_router.include_router(dashboard.router, prefix="/projects/{project_id}/dashboard", tags=["dashboard"])
api_router.include_router(integration.router, prefix="/solve", tags=["integration"])

