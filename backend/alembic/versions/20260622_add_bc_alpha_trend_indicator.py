"""add BC AlphaTrend indicator

Revision ID: c7e8f9a0b1c2
Revises: a4d9e6f2c8b7
Create Date: 2026-06-22 00:00:00.000000
"""

from __future__ import annotations

from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c7e8f9a0b1c2"
down_revision = "a4d9e6f2c8b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    indicator_table = sa.table(
        "bot_indicators",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("key", sa.String),
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.Text),
        sa.column("status", sa.String),
        sa.column("parameter_schema", postgresql.JSONB),
        sa.column("output_schema", postgresql.JSONB),
        sa.column("default_parameters", postgresql.JSONB),
        sa.column("supported_timeframes", postgresql.JSONB),
        sa.column("required_inputs", postgresql.JSONB),
        sa.column("engine_handler", sa.String),
        sa.column("sort_order", sa.Integer),
    )

    indicator = {
        "id": uuid4(),
        "key": "bc_alpha_trend",
        "name": "BC AlphaTrend",
        "category": "trend",
        "description": "AlphaTrend adaptado para BC Futuros, combinando ATR, fluxo MFI/RSI, tendencia e gatilhos long/short.",
        "status": "active",
        "parameter_schema": {
            "atr_length": {"type": "integer", "default": 14, "min": 1, "max": 500},
            "atr_multiplier": {"type": "number", "default": 1.0, "min": 0.1, "max": 20},
            "flow_source": {"type": "select", "default": "auto", "options": ["auto", "mfi", "rsi"]},
            "flow_length": {"type": "integer", "default": 14, "min": 1, "max": 500},
            "flow_threshold": {"type": "number", "default": 50.0, "min": 1, "max": 99},
            "trend_offset": {"type": "integer", "default": 2, "min": 1, "max": 20},
        },
        "output_schema": {
            "outputs": ["value", "trend", "signal", "long_signal", "short_signal", "stop", "atr", "flow"]
        },
        "default_parameters": {
            "atr_length": 14,
            "atr_multiplier": 1.0,
            "flow_source": "auto",
            "flow_length": 14,
            "flow_threshold": 50.0,
            "trend_offset": 2,
        },
        "supported_timeframes": ["1m", "5m", "15m", "1h", "4h", "1d"],
        "required_inputs": ["ohlcv"],
        "engine_handler": "technical.bc_alpha_trend",
        "sort_order": 57,
    }

    statement = postgresql.insert(indicator_table).on_conflict_do_update(
        index_elements=["key"],
        set_={
            "name": indicator["name"],
            "category": indicator["category"],
            "description": indicator["description"],
            "status": indicator["status"],
            "parameter_schema": indicator["parameter_schema"],
            "output_schema": indicator["output_schema"],
            "default_parameters": indicator["default_parameters"],
            "supported_timeframes": indicator["supported_timeframes"],
            "required_inputs": indicator["required_inputs"],
            "engine_handler": indicator["engine_handler"],
            "sort_order": indicator["sort_order"],
        },
    )
    op.get_bind().execute(statement, [indicator])


def downgrade() -> None:
    op.execute("DELETE FROM bot_indicators WHERE key = 'bc_alpha_trend'")
