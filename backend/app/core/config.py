"""Application configuration using pydantic-settings.

All credentials MUST be provided via environment variables.
The application will refuse to start if required variables are missing.
"""

import sys
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "VIOSINT"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"

    # Security — REQUIRED, no defaults
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # Bootstrap accounts — REQUIRED
    ADMIN_PASSWORD: str = ""
    ANALYST_PASSWORD: str = ""

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    # PostgreSQL — REQUIRED
    POSTGRES_HOST: str = ""
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis — REQUIRED
    REDIS_HOST: str = ""
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = ""

    # CV Pipeline
    CV_PIPELINE_URL: str = "http://localhost:8001"
    DETECTION_CONFIDENCE_THRESHOLD: float = 0.5
    EMBEDDING_SIMILARITY_THRESHOLD: float = 0.75

    # Demo mode — auto-seed database on startup if empty
    DEMO_MODE: bool = False

    # Storage
    UPLOAD_DIR: str = "/tmp/viosint/uploads"
    VIDEO_UPLOAD_DIR: str = "/tmp/viosint/videos"
    FRAME_CAPTURE_DIR: str = "/tmp/viosint/frames"

    # Celery
    CELERY_BROKER_URL: Optional[str] = None

    @property
    def celery_broker(self) -> str:
        return self.CELERY_BROKER_URL or self.redis_url

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_required(cls, v: str) -> str:
        if not v:
            print("FATAL: SECRET_KEY environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    @field_validator("POSTGRES_HOST")
    @classmethod
    def postgres_host_required(cls, v: str) -> str:
        if not v:
            print("FATAL: POSTGRES_HOST environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    @field_validator("POSTGRES_USER")
    @classmethod
    def postgres_user_required(cls, v: str) -> str:
        if not v:
            print("FATAL: POSTGRES_USER environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    @field_validator("POSTGRES_PASSWORD")
    @classmethod
    def postgres_password_required(cls, v: str) -> str:
        if not v:
            print("FATAL: POSTGRES_PASSWORD environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    @field_validator("POSTGRES_DB")
    @classmethod
    def postgres_db_required(cls, v: str) -> str:
        if not v:
            print("FATAL: POSTGRES_DB environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    @field_validator("REDIS_HOST")
    @classmethod
    def redis_host_required(cls, v: str) -> str:
        if not v:
            print("FATAL: REDIS_HOST environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    @field_validator("ADMIN_PASSWORD")
    @classmethod
    def admin_password_required(cls, v: str) -> str:
        if not v:
            print("FATAL: ADMIN_PASSWORD environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    @field_validator("ANALYST_PASSWORD")
    @classmethod
    def analyst_password_required(cls, v: str) -> str:
        if not v:
            print("FATAL: ANALYST_PASSWORD environment variable is required.", file=sys.stderr)
            sys.exit(1)
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
