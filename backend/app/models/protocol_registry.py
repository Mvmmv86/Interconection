"""Protocol Registry model - master list of supported protocols and chains."""

from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ProtocolRegistry(Base, UUIDMixin, TimestampMixin):
    """Protocol Registry - stores metadata about supported DeFi protocols."""

    __tablename__ = "protocol_registry"

    # Identification
    protocol_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # e.g., 'uniswap-v3', 'lido'
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # 'dex', 'staking', 'lending'

    # Display info
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#000000", nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Network info
    network_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'evm' or 'solana'
    supported_chains: Mapped[list] = mapped_column(ARRAY(String), nullable=False)  # ['ethereum', 'arbitrum']

    # Protocol-specific
    is_concentrated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # For LP protocols
    program_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Solana program ID

    # Token info (for staking protocols)
    native_token: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # ETH, SOL
    staked_token: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # stETH, mSOL

    # Current metrics
    current_apy: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    tvl_usd: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Additional data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    def __repr__(self) -> str:
        return f"<ProtocolRegistry(id='{self.protocol_id}', name='{self.name}')>"


class ChainRegistry(Base, UUIDMixin, TimestampMixin):
    """Chain Registry - stores metadata about supported blockchains."""

    __tablename__ = "chain_registry"

    # Identification
    chain_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # e.g., 'ethereum', 'solana'
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Display info
    color: Mapped[str] = mapped_column(String(7), default="#000000", nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Network info
    network_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'evm' or 'solana'
    chain_id_number: Mapped[Optional[int]] = mapped_column(nullable=True)  # EVM chain ID (1 for Ethereum)

    # Explorers and RPC
    explorer_url: Mapped[str] = mapped_column(String(255), nullable=False)
    rpc_endpoint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Native token
    native_token: Mapped[str] = mapped_column(String(10), nullable=False)  # ETH, SOL, MATIC
    native_token_decimals: Mapped[int] = mapped_column(default=18, nullable=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_testnet: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Additional data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    def __repr__(self) -> str:
        return f"<ChainRegistry(id='{self.chain_id}', name='{self.name}')>"


class ExchangeRegistry(Base, UUIDMixin, TimestampMixin):
    """Exchange Registry - stores metadata about supported exchanges."""

    __tablename__ = "exchange_registry"

    # Identification
    exchange_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # e.g., 'binance', 'coinbase'
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Display info
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#000000", nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # API info
    api_base_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    has_websocket: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Features
    supports_spot: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_margin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    supports_futures: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_passphrase: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Additional data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    def __repr__(self) -> str:
        return f"<ExchangeRegistry(id='{self.exchange_id}', name='{self.name}')>"
