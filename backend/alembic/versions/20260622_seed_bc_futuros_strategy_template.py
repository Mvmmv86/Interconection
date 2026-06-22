"""seed BC Futuros strategy and bot template

Revision ID: d3e4f5a6b7c8
Revises: c7e8f9a0b1c2
Create Date: 2026-06-22 00:10:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "d3e4f5a6b7c8"
down_revision = "c7e8f9a0b1c2"
branch_labels = None
depends_on = None


STRATEGY_ID = "8f1d4a5f-41b9-4bc2-bcef-6d0e3bd608f1"
TEMPLATE_ID = "d6b5a913-0b6e-4f36-aa84-2632c028de65"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO bot_strategies (
            id,
            name,
            slug,
            description,
            type,
            status,
            version,
            market_config,
            indicator_config,
            rule_config,
            risk_defaults
        )
        VALUES (
            '{STRATEGY_ID}'::uuid,
            'BC Futuros Trend Long-Only',
            'bc-futuros-trend',
            'Estrategia trend-following long-only baseada no AlphaTrend BC com ATR, fluxo MFI/RSI e saida por reversao de tendencia. Paper-only ate suporte short, executor futures e reconciliacao serem aprovados.',
            'SIGNAL'::bottemplatetype,
            'PUBLISHED'::botstrategystatus,
            2,
            '{{
                "market_type": "futures",
                "allowed_symbols": ["BTC", "ETH", "SOL"],
                "supported_timeframes": ["5m", "15m", "1h", "4h"],
                "supported_exchanges": ["bybit", "binance"]
            }}'::jsonb,
            '{{
                "version": 2,
                "engine": "strategy_rules_v2",
                "indicators": [
                    {{
                        "key": "bc_alpha_trend",
                        "name": "BC AlphaTrend",
                        "category": "trend",
                        "parameters": {{
                            "atr_length": 14,
                            "atr_multiplier": 1.0,
                            "flow_source": "auto",
                            "flow_length": 14,
                            "flow_threshold": 50,
                            "trend_offset": 2
                        }},
                        "outputs": ["value", "trend", "signal", "long_signal", "short_signal", "stop", "atr", "flow"]
                    }}
                ]
            }}'::jsonb,
            '{{
                "version": 2,
                "entry": {{
                    "action": "buy",
                    "logic": "AND",
                    "conditions": [
                        {{
                            "indicator": "bc_alpha_trend",
                            "output": "long_signal",
                            "operator": "greater_than",
                            "right_type": "value",
                            "value": 0,
                            "value_max": null,
                            "compare_to": null
                        }}
                    ]
                }},
                "exit": {{
                    "action": "sell",
                    "logic": "AND",
                    "conditions": [
                        {{
                            "indicator": "bc_alpha_trend",
                            "output": "short_signal",
                            "operator": "greater_than",
                            "right_type": "value",
                            "value": 0,
                            "value_max": null,
                            "compare_to": null
                        }}
                    ]
                }}
            }}'::jsonb,
            '{{
                "max_order_usd": 100,
                "max_position_usd": 1000,
                "stop_model": "alpha_trend",
                "entry_mode": "close_confirmation",
                "risk_per_trade_percent": 1,
                "max_exposure_per_trade_percent": 20,
                "max_exposure_per_asset_percent": 20,
                "max_total_exposure_percent": 100,
                "max_simultaneous_risk_percent": 5,
                "stop_loss_percent": 0,
                "take_profit_percent": 0,
                "trailing_stop_percent": 0,
                "breakeven_activation_percent": 0,
                "cooldown_minutes": 60,
                "max_daily_signals": 5,
                "allow_averaging": false
            }}'::jsonb
        )
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            type = EXCLUDED.type,
            status = EXCLUDED.status,
            version = EXCLUDED.version,
            market_config = EXCLUDED.market_config,
            indicator_config = EXCLUDED.indicator_config,
            rule_config = EXCLUDED.rule_config,
            risk_defaults = EXCLUDED.risk_defaults,
            updated_at = now()
        """
    )

    op.execute(
        f"""
        INSERT INTO bot_templates (
            id,
            name,
            slug,
            description,
            type,
            status,
            required_plan,
            requires_trade_permission,
            supported_exchanges,
            supported_assets,
            default_parameters,
            risk_notes,
            strategy_id
        )
        VALUES (
            '{TEMPLATE_ID}'::uuid,
            'BC Futuros Paper Bot Long-Only',
            'bc-futuros-paper-bot',
            'Bot operacional paper baseado na estrategia BC Futuros Trend Long-Only. O live trading e entradas short permanecem bloqueados ate executor futures e reconciliacao serem aprovados.',
            'SIGNAL'::bottemplatetype,
            'PUBLISHED'::bottemplatestatus,
            'PRO'::plantype,
            false,
            '["bybit", "binance"]'::jsonb,
            '["BTC", "ETH", "SOL"]'::jsonb,
            '{{
                "strategy_slug": "bc-futuros-trend",
                "execution_mode": "paper",
                "live_guard": "disabled",
                "entry_mode": "close_confirmation",
                "stop_model": "alpha_trend"
            }}'::jsonb,
            'Paper-only long-only. Position sizing futures, entradas short, leverage e reconciliation serao liberados em fases posteriores.',
            (SELECT id FROM bot_strategies WHERE slug = 'bc-futuros-trend')
        )
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            type = EXCLUDED.type,
            status = EXCLUDED.status,
            required_plan = EXCLUDED.required_plan,
            requires_trade_permission = EXCLUDED.requires_trade_permission,
            supported_exchanges = EXCLUDED.supported_exchanges,
            supported_assets = EXCLUDED.supported_assets,
            default_parameters = EXCLUDED.default_parameters,
            risk_notes = EXCLUDED.risk_notes,
            strategy_id = EXCLUDED.strategy_id,
            updated_at = now()
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM bot_templates WHERE slug = 'bc-futuros-paper-bot'")
    op.execute("DELETE FROM bot_strategies WHERE slug = 'bc-futuros-trend'")
