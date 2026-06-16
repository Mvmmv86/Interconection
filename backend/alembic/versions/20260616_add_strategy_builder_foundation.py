"""add strategy builder indicator catalog

Revision ID: a4d9e6f2c8b7
Revises: f2c6d9a4b8e1
Create Date: 2026-06-16 18:30:00.000000
"""

from __future__ import annotations

from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a4d9e6f2c8b7"
down_revision = "f2c6d9a4b8e1"
branch_labels = None
depends_on = None


def _number_param(default: float, min_value: float | None = None, max_value: float | None = None) -> dict:
    schema = {"type": "number", "default": default}
    if min_value is not None:
        schema["min"] = min_value
    if max_value is not None:
        schema["max"] = max_value
    return schema


def _length_param(default: int) -> dict:
    return {"type": "integer", "default": default, "min": 1, "max": 500}


def _source_param(default: str = "close") -> dict:
    return {"type": "select", "default": default, "options": ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4", "volume"]}


def _indicator(
    key: str,
    name: str,
    category: str,
    description: str,
    parameters: dict,
    outputs: list[str],
    *,
    required_inputs: list[str] | None = None,
    timeframes: list[str] | None = None,
    sort_order: int = 0,
) -> dict:
    return {
        "id": uuid4(),
        "key": key,
        "name": name,
        "category": category,
        "description": description,
        "status": "active",
        "parameter_schema": parameters,
        "output_schema": {"outputs": outputs},
        "default_parameters": {
            name: spec.get("default")
            for name, spec in parameters.items()
            if isinstance(spec, dict) and "default" in spec
        },
        "supported_timeframes": timeframes or ["1m", "5m", "15m", "1h", "4h", "1d"],
        "required_inputs": required_inputs or ["ohlcv"],
        "engine_handler": f"technical.{key}",
        "sort_order": sort_order,
    }


def upgrade() -> None:
    op.add_column(
        "bot_strategies",
        sa.Column(
            "market_config",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.create_table(
        "bot_indicators",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=40), server_default="active", nullable=False),
        sa.Column("parameter_schema", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("output_schema", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("default_parameters", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("supported_timeframes", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("required_inputs", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("engine_handler", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_bot_indicators_key"),
    )
    op.create_index("ix_bot_indicators_category", "bot_indicators", ["category"])
    op.create_index("ix_bot_indicators_status", "bot_indicators", ["status"])

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

    indicators = [
        _indicator("sma", "Simple Moving Average", "moving_average", "Media aritmetica simples para suavizar preco.", {"length": _length_param(20), "source": _source_param()}, ["value"], sort_order=10),
        _indicator("ema", "Exponential Moving Average", "moving_average", "Media movel exponencial que reage mais rapido ao preco recente.", {"length": _length_param(20), "source": _source_param()}, ["value"], sort_order=11),
        _indicator("wma", "Weighted Moving Average", "moving_average", "Media ponderada com maior peso para candles recentes.", {"length": _length_param(20), "source": _source_param()}, ["value"], sort_order=12),
        _indicator("rma", "Wilder Moving Average", "moving_average", "Media suavizada usada em RSI/ATR.", {"length": _length_param(14), "source": _source_param()}, ["value"], sort_order=13),
        _indicator("hma", "Hull Moving Average", "moving_average", "Media responsiva com menor atraso.", {"length": _length_param(20), "source": _source_param()}, ["value"], sort_order=14),
        _indicator("vwma", "Volume Weighted Moving Average", "moving_average", "Media ponderada por volume.", {"length": _length_param(20), "source": _source_param()}, ["value"], required_inputs=["ohlcv", "volume"], sort_order=15),
        _indicator("dema", "Double EMA", "moving_average", "Media exponencial dupla para reduzir lag.", {"length": _length_param(20), "source": _source_param()}, ["value"], sort_order=16),
        _indicator("tema", "Triple EMA", "moving_average", "Media exponencial tripla para tendencia mais responsiva.", {"length": _length_param(20), "source": _source_param()}, ["value"], sort_order=17),
        _indicator("kama", "Kaufman Adaptive Moving Average", "moving_average", "Media adaptativa baseada em eficiencia de mercado.", {"length": _length_param(10), "fast_length": _length_param(2), "slow_length": _length_param(30), "source": _source_param()}, ["value"], sort_order=18),
        _indicator("alma", "Arnaud Legoux Moving Average", "moving_average", "Media com offset/sigma para suavizacao avancada.", {"length": _length_param(20), "offset": _number_param(0.85, 0, 1), "sigma": _number_param(6, 1, 20), "source": _source_param()}, ["value"], sort_order=19),
        _indicator("rsi", "Relative Strength Index", "momentum", "Oscilador de momentum para sobrecompra/sobrevenda.", {"length": _length_param(14), "source": _source_param()}, ["value"], sort_order=30),
        _indicator("macd", "MACD", "momentum", "Diferenca entre medias rapida/lenta com linha de sinal.", {"fast_length": _length_param(12), "slow_length": _length_param(26), "signal_length": _length_param(9), "source": _source_param()}, ["macd", "signal", "histogram"], sort_order=31),
        _indicator("stochastic", "Stochastic Oscillator", "momentum", "Compara fechamento contra range recente.", {"k_length": _length_param(14), "d_length": _length_param(3), "smooth": _length_param(3)}, ["k", "d"], sort_order=32),
        _indicator("stoch_rsi", "Stochastic RSI", "momentum", "Stochastic aplicado ao RSI.", {"rsi_length": _length_param(14), "stoch_length": _length_param(14), "k_length": _length_param(3), "d_length": _length_param(3)}, ["k", "d"], sort_order=33),
        _indicator("cci", "Commodity Channel Index", "momentum", "Mede desvio do preco tipico contra media.", {"length": _length_param(20), "source": _source_param("hlc3")}, ["value"], sort_order=34),
        _indicator("roc", "Rate of Change", "momentum", "Variação percentual do preco contra candles anteriores.", {"length": _length_param(12), "source": _source_param()}, ["value"], sort_order=35),
        _indicator("momentum", "Momentum", "momentum", "Diferenca entre preco atual e preco passado.", {"length": _length_param(10), "source": _source_param()}, ["value"], sort_order=36),
        _indicator("williams_r", "Williams %R", "momentum", "Oscilador de sobrevenda/sobrecompra baseado em high/low.", {"length": _length_param(14)}, ["value"], sort_order=37),
        _indicator("ultimate_oscillator", "Ultimate Oscillator", "momentum", "Oscilador multi-periodo de pressao compradora.", {"short_length": _length_param(7), "mid_length": _length_param(14), "long_length": _length_param(28)}, ["value"], sort_order=38),
        _indicator("awesome_oscillator", "Awesome Oscillator", "momentum", "Momentum baseado em medias do preco medio.", {"fast_length": _length_param(5), "slow_length": _length_param(34)}, ["value"], sort_order=39),
        _indicator("adx", "Average Directional Index", "trend", "Forca de tendencia independente da direcao.", {"length": _length_param(14)}, ["adx"], sort_order=50),
        _indicator("dmi", "Directional Movement Index", "trend", "Direcao de tendencia com DI+ e DI-.", {"length": _length_param(14), "smoothing": _length_param(14)}, ["plus_di", "minus_di", "adx"], sort_order=51),
        _indicator("supertrend", "Supertrend", "trend", "Filtro de tendencia usando ATR.", {"atr_length": _length_param(10), "factor": _number_param(3, 0.1, 20)}, ["value", "direction"], sort_order=52),
        _indicator("parabolic_sar", "Parabolic SAR", "trend", "Pontos de reversao de tendencia.", {"start": _number_param(0.02, 0.001, 1), "increment": _number_param(0.02, 0.001, 1), "maximum": _number_param(0.2, 0.01, 2)}, ["value", "direction"], sort_order=53),
        _indicator("ichimoku", "Ichimoku Cloud", "trend", "Sistema de tendencia com nuvem, conversao e base.", {"conversion_length": _length_param(9), "base_length": _length_param(26), "span_b_length": _length_param(52), "displacement": _length_param(26)}, ["conversion", "base", "span_a", "span_b"], sort_order=54),
        _indicator("aroon", "Aroon", "trend", "Mede tempo desde maximas/minimas recentes.", {"length": _length_param(14)}, ["up", "down", "oscillator"], sort_order=55),
        _indicator("donchian_channel", "Donchian Channel", "trend", "Canal de maximas/minimas para rompimentos.", {"length": _length_param(20)}, ["upper", "basis", "lower"], sort_order=56),
        _indicator("bollinger_bands", "Bollinger Bands", "volatility", "Bandas por desvio padrao em torno da media.", {"length": _length_param(20), "stddev": _number_param(2, 0.1, 10), "source": _source_param()}, ["upper", "basis", "lower", "bandwidth"], sort_order=70),
        _indicator("atr", "Average True Range", "volatility", "Volatilidade media do range real.", {"length": _length_param(14)}, ["value"], sort_order=71),
        _indicator("keltner_channel", "Keltner Channel", "volatility", "Canal baseado em EMA e ATR.", {"length": _length_param(20), "atr_length": _length_param(10), "multiplier": _number_param(2, 0.1, 10)}, ["upper", "basis", "lower"], sort_order=72),
        _indicator("standard_deviation", "Standard Deviation", "volatility", "Desvio padrao do preco em uma janela.", {"length": _length_param(20), "source": _source_param()}, ["value"], sort_order=73),
        _indicator("historical_volatility", "Historical Volatility", "volatility", "Volatilidade historica anualizada.", {"length": _length_param(20), "annualization": _number_param(365, 1, 365)}, ["value"], sort_order=74),
        _indicator("obv", "On Balance Volume", "volume", "Fluxo de volume acumulado conforme direcao do preco.", {}, ["value"], required_inputs=["ohlcv", "volume"], sort_order=90),
        _indicator("vwap", "VWAP", "volume", "Preco medio ponderado por volume.", {"source": _source_param("hlc3")}, ["value"], required_inputs=["ohlcv", "volume"], sort_order=91),
        _indicator("volume_sma", "Volume SMA", "volume", "Media simples do volume.", {"length": _length_param(20)}, ["value"], required_inputs=["ohlcv", "volume"], sort_order=92),
        _indicator("mfi", "Money Flow Index", "volume", "RSI ponderado por volume.", {"length": _length_param(14)}, ["value"], required_inputs=["ohlcv", "volume"], sort_order=93),
        _indicator("accumulation_distribution", "Accumulation/Distribution", "volume", "Fluxo acumulado de compra/venda por volume.", {}, ["value"], required_inputs=["ohlcv", "volume"], sort_order=94),
        _indicator("chaikin_money_flow", "Chaikin Money Flow", "volume", "Pressao compradora/vendedora por volume.", {"length": _length_param(20)}, ["value"], required_inputs=["ohlcv", "volume"], sort_order=95),
    ]
    bind = op.get_bind()
    statement = postgresql.insert(indicator_table).on_conflict_do_nothing(index_elements=["key"])
    bind.execute(statement, indicators)

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON bot_indicators TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                REVOKE SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON bot_indicators FROM connectcoin_app;
            END IF;
        END $$;
        """
    )
    op.drop_index("ix_bot_indicators_status", table_name="bot_indicators")
    op.drop_index("ix_bot_indicators_category", table_name="bot_indicators")
    op.drop_table("bot_indicators")
    op.drop_column("bot_strategies", "market_config")
