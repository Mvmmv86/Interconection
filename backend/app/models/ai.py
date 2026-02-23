"""AI-related models - reports and settings."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin


class AIProvider(str, enum.Enum):
    """AI provider options."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"


class ReportType(str, enum.Enum):
    """AI report types."""

    RISK_ANALYSIS = "risk_analysis"
    PERFORMANCE = "performance"
    RECOMMENDATIONS = "recommendations"
    CUSTOM = "custom"


class AIReport(Base, UUIDMixin, TimestampMixin):
    """AI-generated reports - persists generated reports for history."""

    __tablename__ = "ai_reports"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    report_type: Mapped[ReportType] = mapped_column(
        SAEnum(ReportType),
        nullable=False,
        default=ReportType.RISK_ANALYSIS,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Markdown content
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Short summary

    # Snapshot of data used to generate the report
    portfolio_context: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    risk_metrics: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Metadata
    model_used: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # claude-sonnet-4-5, gpt-4, etc
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    generation_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AIReport(id={self.id}, type='{self.report_type.value}', title='{self.title}')>"


class AISettings(Base, UUIDMixin, TimestampMixin):
    """AI provider settings per organization."""

    __tablename__ = "ai_settings"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    provider: Mapped[AIProvider] = mapped_column(
        SAEnum(AIProvider),
        nullable=False,
        default=AIProvider.ANTHROPIC,
    )
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_key_masked: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # sk-...xxxx

    is_configured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    use_platform_key: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # Use our default key

    # Usage tracking
    total_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<AISettings(id={self.id}, org={self.organization_id}, provider='{self.provider.value}')>"
