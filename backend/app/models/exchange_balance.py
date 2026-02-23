"""Exchange balance and position models."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.base import Base, UUIDMixin


class AccountType(str, enum.Enum):
    """Exchange account types."""

    SPOT = "spot"
    FUTURES = "futures"
    MARGIN = "margin"
    EARN = "earn"
    FUNDING = "funding"
    OPTIONS = "options"


class FuturesSide(str, enum.Enum):
    """Futures position side."""

    LONG = "long"
    SHORT = "short"


class EarnProductType(str, enum.Enum):
    """Earn product types."""

    FLEXIBLE = "flexible"
    LOCKED = "locked"
    STAKING = "staking"
    DUAL_INVESTMENT = "dual_investment"
    LAUNCHPOOL = "launchpool"


class ExchangeBalance(Base, UUIDMixin):
    """Exchange balance per asset per account type.

    Stores the latest synced balances from each exchange connection.
    """

    __tablename__ = "exchange_balances"

    exchange_id: Mapped[UUID] = mapped_column(
        ForeignKey("exchanges.id", ondelete="CASCADE"),
        nullable=False,
    )

    asset: Mapped[str] = mapped_column(String(20), nullable=False)  # BTC, ETH, USDT
    account_type: Mapped[AccountType] = mapped_column(
        SAEnum(AccountType),
        nullable=False,
        default=AccountType.SPOT,
    )

    # Balances
    free: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False, default=0)
    locked: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False, default=0)

    # Valuation
    price_usd: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False, default=0)
    value_usd: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    change_24h: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)

    # P&L tracking
    entry_price: Mapped[Optional[float]] = mapped_column(Numeric(20, 8), nullable=True)
    cost_basis: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)
    unrealized_pnl: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)
    unrealized_pnl_percent: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)

    # For earn positions
    apy: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)

    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ExchangeBalance(exchange={self.exchange_id}, {self.asset} {self.account_type.value}: {self.total})>"


class ExchangeFuturesPosition(Base, UUIDMixin):
    """Exchange futures/perpetual positions."""

    __tablename__ = "exchange_futures"

    exchange_id: Mapped[UUID] = mapped_column(
        ForeignKey("exchanges.id", ondelete="CASCADE"),
        nullable=False,
    )

    symbol: Mapped[str] = mapped_column(String(30), nullable=False)  # BTCUSDT, ETHUSDT
    side: Mapped[FuturesSide] = mapped_column(SAEnum(FuturesSide), nullable=False)

    # Position details
    size: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False)
    entry_price: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    mark_price: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    liquidation_price: Mapped[Optional[float]] = mapped_column(Numeric(20, 8), nullable=True)

    leverage: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=1)
    margin_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # cross, isolated
    position_value: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    margin_used: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    # P&L
    unrealized_pnl: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    unrealized_pnl_percent: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    realized_pnl: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    # Funding & fees
    funding_rate: Mapped[Optional[float]] = mapped_column(Numeric(12, 8), nullable=True)
    accumulated_funding: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    # TP/SL
    take_profit: Mapped[Optional[float]] = mapped_column(Numeric(20, 8), nullable=True)
    stop_loss: Mapped[Optional[float]] = mapped_column(Numeric(20, 8), nullable=True)

    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ExchangeFutures({self.symbol} {self.side.value} {self.leverage}x)>"


class ExchangeEarnPosition(Base, UUIDMixin):
    """Exchange earn/savings/staking positions."""

    __tablename__ = "exchange_earn"

    exchange_id: Mapped[UUID] = mapped_column(
        ForeignKey("exchanges.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    product_type: Mapped[EarnProductType] = mapped_column(
        SAEnum(EarnProductType),
        nullable=False,
        default=EarnProductType.FLEXIBLE,
    )
    product_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    coin: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False)
    value_usd: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)

    apy: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    total_interest: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    total_interest_usd: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    # Lock info
    lock_period_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_redeemable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ExchangeEarn({self.coin} {self.product_type.value}: {self.amount})>"


class ExchangeSubaccount(Base, UUIDMixin):
    """Exchange subaccounts (Bybit, OKX, etc.)."""

    __tablename__ = "exchange_subaccounts"

    exchange_id: Mapped[UUID] = mapped_column(
        ForeignKey("exchanges.id", ondelete="CASCADE"),
        nullable=False,
    )

    subaccount_id: Mapped[str] = mapped_column(String(100), nullable=False)
    subaccount_name: Mapped[str] = mapped_column(String(200), nullable=False)

    total_value_usd: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    spot_value: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    futures_value: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    earn_value: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ExchangeSubaccount({self.subaccount_name}: ${self.total_value_usd})>"
