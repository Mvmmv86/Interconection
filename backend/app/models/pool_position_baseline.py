"""Pool Position Baseline — fallback record of initial deposit values.

Used by the LP page to compute Impermanent Loss, VS HODL and Fees Earned
when the protocol subgraph is unavailable, rate-limited, or doesn't index
the chain. Each row represents the first time we observed a position for
a given (organization, wallet, position) combination.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization


class BaselineSource(str, enum.Enum):
    """How the baseline value was determined."""

    SUBGRAPH_HISTORY = "subgraph_history"  # Fetched from protocol subgraph (best)
    FIRST_OBSERVED = "first_observed"      # Snapshot taken when we first saw it
    MANUAL = "manual"                       # User-provided baseline


class PoolPositionBaseline(Base, UUIDMixin, TimestampMixin):
    """Per-organization, per-wallet, per-position baseline of initial deposit.

    Lookup key: (organization_id, wallet_address, position_key).
    position_key format: "{protocol}:{chain}:{nft_id_or_pool_address}".
    """

    __tablename__ = "pool_position_baselines"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "wallet_address",
            "position_key",
            name="uq_pool_baseline_org_wallet_position",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wallet_address: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    position_key: Mapped[str] = mapped_column(String(255), nullable=False)

    # Identification
    protocol: Mapped[str] = mapped_column(String(50), nullable=False)
    chain: Mapped[str] = mapped_column(String(50), nullable=False)

    # Token amounts at baseline time
    token0_symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    token1_symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    token0_amount: Mapped[Decimal] = mapped_column(Numeric(36, 18), nullable=False)
    token1_amount: Mapped[Decimal] = mapped_column(Numeric(36, 18), nullable=False)
    token0_price_usd: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    token1_price_usd: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)

    # Baseline value (sum of token amounts × prices at baseline time)
    baseline_value_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)

    # When the baseline applies from + how it was determined
    baseline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[BaselineSource] = mapped_column(
        SAEnum(BaselineSource),
        default=BaselineSource.FIRST_OBSERVED,
        nullable=False,
    )

    # Number of times we re-snapshotted (e.g., when liquidity changed > 5%)
    resnapshot_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")

    def __repr__(self) -> str:
        return (
            f"<PoolPositionBaseline(key='{self.position_key}', "
            f"value=${self.baseline_value_usd}, source={self.source.value})>"
        )
