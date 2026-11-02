import jwt
import os
import hmac
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException, Query
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

if not JWT_SECRET:
    # Dev-only fallback so local runs work; deployed environments must set JWT_SECRET.
    print("[WARN] JWT_SECRET is not set; using an insecure development secret.")
    JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789"


def create_interview_token(
    candidate_id: str,
    name: str,
    email: str,
    role: str,
    domain: str = "General",
    expires_in_hours: int = 1
) -> str:
    """
    Generates a signed JWT invite token (default 1 hour) embedding the candidate's
    name, email, target role, domain and candidate id.
    """
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(hours=expires_in_hours)

    payload = {
        "sub": str(candidate_id),
        "name": name,
        "email": email,
        "role": role,
        "domain": domain,
        "typ": "invite",
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_interview_token(token: str) -> Dict[str, Any]:
    """Verifies and decodes the interview JWT token, enforcing signature and expiry."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("typ", "invite") != "invite":
            raise jwt.InvalidTokenError("not an invite token")
        return {"valid": True, "expired": False, "payload": payload}
    except jwt.ExpiredSignatureError:
        return {
            "valid": False,
            "expired": True,
            "error": "This interview invitation has expired (1-hour validity window exceeded)."
        }
    except jwt.InvalidTokenError as e:
        return {"valid": False, "expired": False, "error": f"Invalid interview token: {str(e)}"}


# ==========================================
# ADMIN AUTH
# ==========================================

def check_admin_credentials(username: str, password: str) -> bool:
    if not ADMIN_PASSWORD:
        print("[WARN] ADMIN_PASSWORD is not set; admin login is disabled.")
        return False
    return hmac.compare_digest(username.strip().lower(), ADMIN_USERNAME.lower()) and \
        hmac.compare_digest(password, ADMIN_PASSWORD)


def create_admin_token(username: str, expires_in_hours: int = 12) -> str:
    issued_at = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "typ": "admin",
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(hours=expires_in_hours)).timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def require_admin(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    FastAPI dependency guarding admin endpoints. Accepts `Authorization: Bearer <token>`,
    or `?token=` for resources loaded directly by the browser (e.g. the resume iframe).
    """
    raw = None
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization[7:].strip()
    elif token:
        raw = token
    if not raw:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    try:
        payload = jwt.decode(raw, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired admin session")
    if payload.get("typ") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload
