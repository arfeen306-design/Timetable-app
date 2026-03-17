"""OAuth endpoints for Google and Microsoft sign-in/sign-up.

Flow:
1. Frontend opens /api/auth/google (or /microsoft) → redirects to provider
2. Provider redirects back to /api/auth/google/callback with code
3. Backend exchanges code for token, gets user info
4. Creates user if new (is_approved=False) or logs in if approved
5. Redirects to frontend with JWT in URL fragment
"""
from __future__ import annotations
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from urllib.parse import urlencode
import httpx
import re

from backend.auth.jwt import create_access_token
from backend.config import get_settings
from backend.models.base import get_db
from backend.models.user import User
from backend.models.school import School, SchoolMembership
from backend.repositories.membership_repo import get_first_school_id_for_user

router = APIRouter()
log = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# GOOGLE
# ═══════════════════════════════════════════════════════════════════════════════

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google")
def google_login(request: Request):
    """Redirect user to Google's OAuth consent screen."""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(501, "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")

    # Build callback URL from APP_URL (not request.base_url which is http behind proxy)
    callback_url = settings.app_url.rstrip("/") + "/api/auth/google/callback"

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(request: Request, code: str = "", error: str = "", db: Session = Depends(get_db)):
    """Handle Google OAuth callback."""
    settings = get_settings()
    if error:
        return RedirectResponse(f"{settings.app_url}/login?error=Google+login+cancelled")
    if not code:
        return RedirectResponse(f"{settings.app_url}/login?error=No+code+received")

    callback_url = settings.app_url.rstrip("/") + "/api/auth/google/callback"

    # Exchange code for tokens
    try:
        resp = httpx.post(GOOGLE_TOKEN_URL, data={
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "code": code,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        }, timeout=10)
        tokens = resp.json()
        if "access_token" not in tokens:
            log.error("Google token exchange failed: %s", tokens)
            return RedirectResponse(f"{settings.app_url}/login?error=Google+login+failed")
    except Exception as e:
        log.error("Google token exchange error: %s", e)
        return RedirectResponse(f"{settings.app_url}/login?error=Google+login+failed")

    # Get user info
    try:
        user_resp = httpx.get(GOOGLE_USERINFO_URL, headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        }, timeout=10)
        user_info = user_resp.json()
    except Exception as e:
        log.error("Google userinfo error: %s", e)
        return RedirectResponse(f"{settings.app_url}/login?error=Could+not+get+user+info")

    email = (user_info.get("email") or "").strip().lower()
    name = user_info.get("name") or email.split("@")[0]

    if not email:
        return RedirectResponse(f"{settings.app_url}/login?error=No+email+from+Google")

    return _handle_oauth_user(db, email, name, "google", settings)


# ═══════════════════════════════════════════════════════════════════════════════
# MICROSOFT
# ═══════════════════════════════════════════════════════════════════════════════

MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MS_USERINFO_URL = "https://graph.microsoft.com/v1.0/me"


@router.get("/microsoft")
def microsoft_login(request: Request):
    """Redirect user to Microsoft's OAuth consent screen."""
    settings = get_settings()
    if not settings.microsoft_client_id:
        raise HTTPException(501, "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.")

    callback_url = settings.app_url.rstrip("/") + "/api/auth/microsoft/callback"

    params = {
        "client_id": settings.microsoft_client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile User.Read",
        "response_mode": "query",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{MS_AUTH_URL}?{urlencode(params)}")


@router.get("/microsoft/callback")
def microsoft_callback(request: Request, code: str = "", error: str = "", db: Session = Depends(get_db)):
    """Handle Microsoft OAuth callback."""
    settings = get_settings()
    if error:
        return RedirectResponse(f"{settings.app_url}/login?error=Microsoft+login+cancelled")
    if not code:
        return RedirectResponse(f"{settings.app_url}/login?error=No+code+received")

    callback_url = settings.app_url.rstrip("/") + "/api/auth/microsoft/callback"

    # Exchange code for tokens
    try:
        resp = httpx.post(MS_TOKEN_URL, data={
            "client_id": settings.microsoft_client_id,
            "client_secret": settings.microsoft_client_secret,
            "code": code,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
            "scope": "openid email profile User.Read",
        }, timeout=10)
        tokens = resp.json()
        if "access_token" not in tokens:
            log.error("Microsoft token exchange failed: %s", tokens)
            return RedirectResponse(f"{settings.app_url}/login?error=Microsoft+login+failed")
    except Exception as e:
        log.error("Microsoft token exchange error: %s", e)
        return RedirectResponse(f"{settings.app_url}/login?error=Microsoft+login+failed")

    # Get user info from Graph API
    try:
        user_resp = httpx.get(MS_USERINFO_URL, headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        }, timeout=10)
        user_info = user_resp.json()
    except Exception as e:
        log.error("Microsoft userinfo error: %s", e)
        return RedirectResponse(f"{settings.app_url}/login?error=Could+not+get+user+info")

    email = (user_info.get("mail") or user_info.get("userPrincipalName") or "").strip().lower()
    name = user_info.get("displayName") or email.split("@")[0]

    if not email:
        return RedirectResponse(f"{settings.app_url}/login?error=No+email+from+Microsoft")

    return _handle_oauth_user(db, email, name, "microsoft", settings)


# ═══════════════════════════════════════════════════════════════════════════════
# SHARED: create or find user
# ═══════════════════════════════════════════════════════════════════════════════

def _handle_oauth_user(db: Session, email: str, name: str, provider: str, settings):
    """Find existing user or create new (auto-approved for OAuth). Redirect to frontend."""

    user = db.query(User).filter(User.email == email).first()

    if user:
        # Existing user — auto-approve if not yet approved (e.g. previously registered via email)
        if not getattr(user, "is_approved", True):
            user.is_approved = True
            db.commit()
        # Issue JWT and log in
        school_id = get_first_school_id_for_user(db, user.id)
        payload = {
            "id": user.id, "email": user.email,
            "name": user.name or "", "role": user.role,
            "school_id": school_id,
        }
        token = create_access_token(subject=user.email, payload=payload)
        log.info("OAuth login: existing user %s, redirecting with token", email)
        return RedirectResponse(f"{settings.app_url}/oauth-callback?token={token}", status_code=302)

    # New user — create with is_approved=True (OAuth users are trusted)
    user = User(
        email=email,
        password_hash="oauth-no-password",  # OAuth users don't have passwords
        name=name,
        role="school_admin",
        is_active=True,
        is_approved=True,  # Auto-approved for OAuth sign-in
        email_verified_at=datetime.utcnow(),
    )
    db.add(user)
    db.flush()

    # Create school from name
    school_name = name if name else email.split("@")[0]
    slug = re.sub(r"[^a-z0-9]+", "-", school_name.lower()).strip("-") or "school"
    base_slug = slug
    counter = 1
    while db.query(School).filter(School.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    school = School(name=school_name, slug=slug)
    db.add(school)
    db.flush()

    membership = SchoolMembership(school_id=school.id, user_id=user.id, role="admin")
    db.add(membership)
    db.commit()

    log.info("New OAuth user (%s) registered via %s: %s", email, provider, name)

    # Auto-login: issue JWT immediately
    school_id = school.id
    payload = {
        "id": user.id, "email": user.email,
        "name": user.name or "", "role": user.role,
        "school_id": school_id,
    }
    token = create_access_token(subject=user.email, payload=payload)
    log.info("OAuth login: new user %s created via %s, redirecting with token", email, provider)
    return RedirectResponse(f"{settings.app_url}/oauth-callback?token={token}", status_code=302)
