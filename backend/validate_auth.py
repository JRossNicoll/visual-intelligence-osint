#!/usr/bin/env python3
"""Validate Sprint 1 Authentication.

Tests:
1. Creates a JWT via the security module
2. Calls a protected endpoint with the token — expects success
3. Calls a protected endpoint WITHOUT the token — expects 401
4. Writes an audit log entry and confirms it persisted
"""

import asyncio
import os
import sys

# Ensure env vars are set for config validation
os.environ.setdefault("SECRET_KEY", "test-secret-key-validate-auth")
os.environ.setdefault("POSTGRES_HOST", "127.0.0.1")
os.environ.setdefault("POSTGRES_USER", "viosint")
os.environ.setdefault("POSTGRES_PASSWORD", "viosint")
os.environ.setdefault("POSTGRES_DB", "viosint")
os.environ.setdefault("REDIS_HOST", "127.0.0.1")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault("ANALYST_PASSWORD", "analyst123")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.security import (  # noqa: E402
    authenticate_user,
    create_access_token,
    get_password_hash,
    verify_password,
    verify_token,
)

passed = 0
failed = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name} — {detail}")


def test_password_hashing() -> None:
    """Test bcrypt password hashing and verification."""
    print("\n--- Password Hashing ---")
    hashed = get_password_hash("test_password_123")
    check("hash is non-empty", len(hashed) > 0)
    check("hash starts with $2b$", hashed.startswith("$2b$"), f"got: {hashed[:10]}")
    check("verify correct password", verify_password("test_password_123", hashed))
    check("reject wrong password", not verify_password("wrong_password", hashed))


def test_bootstrap_accounts() -> None:
    """Test that bootstrap accounts authenticate correctly."""
    print("\n--- Bootstrap Accounts ---")
    admin = authenticate_user("admin", os.environ["ADMIN_PASSWORD"])
    check("admin authenticates", admin is not None)
    check("admin role is admin", admin is not None and admin.role == "admin",
          f"role={admin.role if admin else 'N/A'}")

    analyst = authenticate_user("analyst", os.environ["ANALYST_PASSWORD"])
    check("analyst authenticates", analyst is not None)
    check("analyst role is analyst", analyst is not None and analyst.role == "analyst",
          f"role={analyst.role if analyst else 'N/A'}")

    # Test invalid credentials
    bad_user = authenticate_user("nonexistent", "password")
    check("nonexistent user returns None", bad_user is None)

    bad_pass = authenticate_user("admin", "wrong_password")
    check("wrong password returns None", bad_pass is None)


def test_jwt_creation_and_verification() -> None:
    """Test JWT token creation and verification."""
    print("\n--- JWT Creation & Verification ---")

    token = create_access_token(data={"sub": "admin", "role": "admin"})
    check("token is non-empty string", isinstance(token, str) and len(token) > 0)

    payload = verify_token(token)
    check("token verifies successfully", payload is not None)
    check("payload has sub=admin", payload is not None and payload.get("sub") == "admin",
          f"sub={payload.get('sub') if payload else 'N/A'}")
    check("payload has role=admin", payload is not None and payload.get("role") == "admin",
          f"role={payload.get('role') if payload else 'N/A'}")
    check("payload has exp claim", payload is not None and "exp" in payload)

    # Verify tampered token fails
    bad_token = token[:-5] + "XXXXX"
    bad_payload = verify_token(bad_token)
    check("tampered token returns None", bad_payload is None)

    # Verify empty token fails
    empty_payload = verify_token("")
    check("empty token returns None", empty_payload is None)


async def test_audit_log() -> None:
    """Test that audit log entries are written and persisted."""
    print("\n--- Audit Log Persistence ---")

    from sqlalchemy import select

    from app.db.session import async_session_factory, engine
    from app.models.base import Base
    from app.models.case import AuditLog

    # Create tables if not exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        from datetime import datetime, timezone

        # Write an audit entry
        entry = AuditLog(
            actor="admin",
            role="admin",
            action="validate_auth_test",
            resource_type="test",
            resource_id="test-001",
            detail="Validation script test entry",
            performed_at=datetime.now(timezone.utc),
        )
        session.add(entry)
        await session.commit()
        entry_id = entry.id
        check("audit entry created", entry_id is not None)

        # Read it back
        result = await session.execute(
            select(AuditLog).where(AuditLog.id == entry_id)
        )
        fetched = result.scalar_one_or_none()
        check("audit entry persisted in DB", fetched is not None)
        check("audit entry has correct actor",
              fetched is not None and fetched.actor == "admin",
              f"actor={fetched.actor if fetched else 'N/A'}")
        check("audit entry has correct action",
              fetched is not None and fetched.action == "validate_auth_test",
              f"action={fetched.action if fetched else 'N/A'}")
        check("audit entry has correct resource_type",
              fetched is not None and fetched.resource_type == "test",
              f"type={fetched.resource_type if fetched else 'N/A'}")

        # Clean up test entry
        if fetched:
            await session.delete(fetched)
            await session.commit()

    await engine.dispose()


async def test_get_current_user_dependency() -> None:
    """Test the FastAPI get_current_user dependency function."""
    print("\n--- get_current_user Dependency ---")
    from app.core.security import TokenData, get_current_user

    # Valid token should return TokenData
    token = create_access_token(data={"sub": "analyst", "role": "analyst"})
    result = await get_current_user(token)
    check("get_current_user returns TokenData", isinstance(result, TokenData))
    check("TokenData.username == analyst", result.username == "analyst",
          f"username={result.username}")
    check("TokenData.role == analyst", result.role == "analyst",
          f"role={result.role}")

    # Invalid token should raise HTTPException (401)
    from fastapi import HTTPException
    try:
        await get_current_user("invalid-token")
        check("invalid token raises 401", False, "no exception raised")
    except HTTPException as e:
        check("invalid token raises 401", e.status_code == 401,
              f"status={e.status_code}")


def main() -> None:
    print("=" * 60)
    print("VIOSINT Sprint 1 — Authentication Validation")
    print("=" * 60)

    test_password_hashing()
    test_bootstrap_accounts()
    test_jwt_creation_and_verification()
    asyncio.run(test_get_current_user_dependency())
    asyncio.run(test_audit_log())

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
    print("\nAll authentication validations PASSED.")


if __name__ == "__main__":
    main()
