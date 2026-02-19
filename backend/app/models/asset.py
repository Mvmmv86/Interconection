"""Asset model."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Asset(Base, UUIDMixin, TimestampMixin):
    """Asset model - represents a cryptocurrency/token."""

    __tablename__ = "assets"

    symbol: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    coingecko_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decimals: Mapped[int] = mapped_column(Integer, default=18, nullable=False)
    chain: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # for native tokens
    contract_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_price_usd: Mapped[Decimal] = mapped_column(
        Numeric(24, 12),
        default=Decimal("0"),
        nullable=False,
    )
    price_change_24h: Mapped[Decimal] = mapped_column(
        Numeric(10, 4),
        default=Decimal("0"),
        nullable=False,
    )
    market_cap: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    last_price_update: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Asset(id={self.id}, symbol='{self.symbol}', price=${self.current_price_usd})>"
