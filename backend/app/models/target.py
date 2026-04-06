"""Target definition models for custom intelligence targets."""

from typing import Optional

from sqlalchemy import Boolean, Float, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Target(Base, UUIDMixin, TimestampMixin):
    """A user-defined target to watch for.

    Examples:
      - "white Toyota Hilux"
      - "person wearing red hoodie"
      - "black SUV with roof racks"
    """

    __tablename__ = "targets"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # person, vehicle, object
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Text-based definition (will be embedded via CLIP)
    text_query: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Embedding of the text query or reference image
    text_embedding: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    image_embedding: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Reference image path
    reference_image_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Matching configuration
    similarity_threshold: Mapped[float] = mapped_column(
        Float, default=0.75, nullable=False
    )

    # Attributes filter (optional structured criteria)
    attribute_filters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., {"color": "white", "make": "Toyota", "type": "truck"}

    # Alert configuration
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    webhook_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Match statistics
    total_matches: Mapped[int] = mapped_column(
        default=0, nullable=False
    )
    priority: Mapped[str] = mapped_column(
        String(20), default="medium", nullable=False
    )  # low, medium, high, critical
