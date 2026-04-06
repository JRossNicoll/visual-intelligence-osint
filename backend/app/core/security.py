"""Security utilities for authentication and authorization.

Bootstrap accounts (admin, analyst) are loaded from environment variables.
No user management — just two hardcoded accounts for Sprint 1.
"""

import functools
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class TokenData(BaseModel):
    username: str
    role: str


class User(BaseModel):
    username: str
    role: str  # admin or analyst
    hashed_password: str


@functools.lru_cache(maxsize=1)
def _get_bootstrap_users() -> dict[str, User]:
    """Build the bootstrap user table from environment variables.

    Cached so bcrypt hashing only runs once (not on every login).
    Password changes via env vars require a server restart.
    """
    return {
        "admin": User(
            username="admin",
            role="admin",
            hashed_password=pwd_context.hash(settings.ADMIN_PASSWORD),
        ),
        "analyst": User(
            username="analyst",
            role="analyst",
            hashed_password=pwd_context.hash(settings.ANALYST_PASSWORD),
        ),
    }


def authenticate_user(username: str, password: str) -> Optional[User]:
    """Authenticate against bootstrap accounts."""
    users = _get_bootstrap_users()
    user = users.get(username)
    if not user:
        return None
    if not pwd_context.verify(password, user.hashed_password):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    """FastAPI dependency — extracts and validates the current user from JWT."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
    username: Optional[str] = payload.get("sub")
    role: Optional[str] = payload.get("role")
    if username is None or role is None:
        raise credentials_exception
    return TokenData(username=username, role=role)
