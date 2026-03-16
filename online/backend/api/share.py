"""Share API — upload PDF for temp sharing, download by UID."""
from __future__ import annotations
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.models.base import get_db
from backend.models.task_model import ShareLink

router = APIRouter()

SHARE_DIR = "/tmp/schedulr_shares"
os.makedirs(SHARE_DIR, exist_ok=True)


@router.post("/upload-pdf")
def upload_pdf_for_sharing(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    uid = str(uuid.uuid4())
    filepath = os.path.join(SHARE_DIR, f"{uid}.pdf")
    content = file.file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    link = ShareLink(
        uid=uid,
        filename=file.filename or "document.pdf",
        expires_at=expires,
    )
    db.add(link)
    db.commit()

    # Build URL (relative — frontend will resolve it)
    url = f"/api/share/download/{uid}"
    return {"url": url, "uid": uid, "expires_at": expires.isoformat()}


@router.get("/download/{uid}")
def download_shared_pdf(uid: str, db: Session = Depends(get_db)):
    link = db.query(ShareLink).filter(ShareLink.uid == uid).first()
    if not link:
        raise HTTPException(404, "Link not found or expired")

    if link.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(410, "Link expired")

    filepath = os.path.join(SHARE_DIR, f"{uid}.pdf")
    if not os.path.exists(filepath):
        raise HTTPException(404, "File not found")

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=link.filename,
    )
