'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bot, Pause, Play, RefreshCw, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import {
  api,
  type BotInstance,
  type BotBacktestRun,
  type BotBacktestTrade,
  type BotMarketRanking,
  type BotMarketUniverseAsset,
  type BotSignal,
  type BotStrategy,
  type BotTemplate,
  type ClientListItem,
  type ClientPortfolioData,
} from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';

type TemplateConfig = {
  clientId: string;
  exchangeId: string;
  strategyId: string;
  maxOrderUsd: string;
  maxPositionUsd: string;
  maxDailySignals: string;
  allowedSymbols: string;
  basketMode: BasketMode;
  basketTimeframe: RankingTimeframe;
  basketTopGainers: string;
  basketTopLosers: string;
  basketRefreshDays: string;
  basketRefreshTime: string;
};

type BasketMode = 'market_extremes' | 'scanner';
type RankingDirection = 'gainers' | 'losers';
type RankingTimeframe = '1h' | '24h' | '7d' | '30d';
type PlanName = 'free' | 'pro' | 'enterprise';
type BacktestForm = {
  timeframe: string;
  months: string;
  initialCapitalUsd: string;
  feePercent: string;
  slippagePercent: string;
};
type BacktestSelection = {
  instance: BotInstance;
  symbol: string;
};

const planRank: Record<PlanName, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

const defaultTemplateConfig: TemplateConfig = {
  clientId: '',
  exchangeId: '',
  strategyId: '',
  maxOrderUsd: '100',
  maxPositionUsd: '1000',
  maxDailySignals: '20',
  allowedSymbols: '',
  basketMode: 'market_extremes',
  basketTimeframe: '7d',
  basketTopGainers: '10',
  basketTopLosers: '10',
  basketRefreshDays: '7',
  basketRefreshTime: '09:00',
};

const defaultBacktestForm: BacktestForm = {
  timeframe: '4h',
  months: '6',
  initialCapitalUsd: '10000',
  feePercent: '0.1',
  slippagePercent: '0.05',
};

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePlan(value: string | null | undefined): PlanName {
  const normalized = String(value || 'free').toLowerCase();
  if (normalized === 'enterprise') return 'enterprise';
  if (normalized === 'pro') return 'pro';
  return 'free';
}

function planAllows(currentPlan: string | null | undefined, requiredPlan: string | null | undefined) {
  return planRank[normalizePlan(currentPlan)] >= planRank[normalizePlan(requiredPlan)];
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleString('pt-BR');
}

function formatCompactUsd(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(amount) >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(amount) >= 1 ? 2 : 6,
  }).format(amount);
}

function formatCompactNumber(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '0';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '0.00%';
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}%`;
}

function metricRawNumber(run: BotBacktestRun | null, key: string) {
  const value = run?.metrics?.[key] ?? run?.result_summary?.[key];
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metricNumber(run: BotBacktestRun | null, key: string) {
  return metricRawNumber(run, key) ?? 0;
}

function metricLabel(run: BotBacktestRun | null, key: string, kind: 'usd' | 'percent' | 'number' = 'number') {
  const value = metricRawNumber(run, key);
  if (value === null) return 'N/A';
  if (kind === 'usd') return formatCompactUsd(value);
  if (kind === 'percent') return formatPercent(value);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

function compactMetricLabel(value: number | null, kind: 'usd' | 'percent' | 'number' = 'number') {
  if (value === null) return 'N/A';
  if (kind === 'usd') return formatCompactUsd(value);
  if (kind === 'percent') return formatPercent(value);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

function metricTone(value: number | null, positiveIsGood = true) {
  if (value === null || Math.abs(value) < 0.000001) return 'text-text-primary';
  const good = positiveIsGood ? value > 0 : value < 0;
  return good ? 'text-status-success' : 'text-status-error';
}

function statusTone(status: string | undefined | null): 'success' | 'error' | 'yellow' | 'blue' {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'succeeded') return 'success';
  if (normalized === 'failed') return 'error';
  if (['running', 'queued', 'pending'].includes(normalized)) return 'yellow';
  return 'blue';
}

function curveBars(points: unknown[] | undefined, key: string, maxBars = 56, baselineZero = false) {
  const source = Array.isArray(points) ? points : [];
  const values = source
    .map((item) => (isRecord(item) ? Number(item[key]) : Number.NaN))
    .filter((item) => Number.isFinite(item));
  if (!values.length) return [];
  const step = Math.max(1, Math.ceil(values.length / maxBars));
  const sampled = values.filter((_, index) => index % step === 0).slice(-maxBars);
  const min = baselineZero ? 0 : Math.min(...sampled);
  const max = baselineZero ? Math.max(0, ...sampled) : Math.max(...sampled);
  const range = Math.max(0.000001, max - min);
  return sampled.map((value) => Math.max(8, Math.round(((value - min) / range) * 54) + 8));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function botBasketView(instance: BotInstance) {
  const riskConfig = isRecord(instance.risk_config) ? instance.risk_config : {};
  const activeBasket = isRecord(riskConfig.active_basket) ? riskConfig.active_basket : {};
  const basketPolicy = isRecord(riskConfig.basket_policy) ? riskConfig.basket_policy : {};
  const marketBasket = isRecord(riskConfig.market_basket) ? riskConfig.market_basket : {};
  const activeSymbols = asStringArray(activeBasket.symbols);
  const manualSymbols = asStringArray(riskConfig.allowed_symbols);
  const symbols = activeSymbols.length ? activeSymbols : manualSymbols;
  const source = String(activeBasket.source || basketPolicy.source || marketBasket.source || (manualSymbols.length ? 'manual' : 'static'));
  const legs = Array.isArray(activeBasket.legs) ? activeBasket.legs.filter(isRecord) : [];
  return {
    source,
    symbols,
    nextRefreshAt: typeof activeBasket.next_refresh_at === 'string' ? activeBasket.next_refresh_at : null,
    generatedAt: typeof activeBasket.generated_at === 'string' ? activeBasket.generated_at : null,
    legs,
  };
}

function botGateRows(signal: BotSignal | undefined) {
  const riskSnapshot = isRecord(signal?.risk_snapshot) ? signal!.risk_snapshot : {};
  const blocks = asStringArray(riskSnapshot.blocks);
  const warnings = asStringArray(riskSnapshot.data_warnings);
  const rows = [
    {
      label: 'Entrada',
      status: riskSnapshot.entry_passed === true ? 'pass' : riskSnapshot.entry_passed === false ? 'wait' : 'idle',
      detail: riskSnapshot.entry_passed === true ? 'Condicoes aprovadas' : 'Aguardando setup',
    },
    {
      label: 'Saida',
      status: riskSnapshot.exit_passed === true ? 'pass' : riskSnapshot.exit_passed === false ? 'idle' : 'idle',
      detail: riskSnapshot.exit_passed === true ? 'Condicoes de saida ativas' : 'Sem saida agora',
    },
    {
      label: 'Risco',
      status: blocks.length ? 'block' : signal ? 'pass' : 'idle',
      detail: blocks.length ? blocks.join(', ') : signal ? 'Sem bloqueios' : 'Sem ciclo ainda',
    },
    {
      label: 'Dados',
      status: warnings.length ? 'wait' : signal ? 'pass' : 'idle',
      detail: warnings.length ? warnings.join(', ') : signal ? String(riskSnapshot.candle_source || 'dados ok') : 'Aguardando analise',
    },
  ];
  return rows;
}

export default function BotsPage() {
  const { can, activeMembership } = useAuth();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [strategies, setStrategies] = useState<BotStrategy[]>([]);
  const [instances, setInstances] = useState<BotInstance[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [configByTemplate, setConfigByTemplate] = useState<Record<string, TemplateConfig>>({});
  const [exchangesByClient, setExchangesByClient] = useState<Record<string, ClientPortfolioData['exchanges']>>({});
  const [signalsByInstance, setSignalsByInstance] = useState<Record<string, BotSignal[]>>({});
  const [marketRanking, setMarketRanking] = useState<BotMarketRanking | null>(null);
  const [universeAssets, setUniverseAssets] = useState<BotMarketUniverseAsset[]>([]);
  const [rankingDirection, setRankingDirection] = useState<RankingDirection>('gainers');
  const [rankingTimeframe, setRankingTimeframe] = useState<RankingTimeframe>('24h');
  const [rankingExchange, setRankingExchange] = useState('bingx');
  const [rankingMarketType, setRankingMarketType] = useState('futures');
  const [rankingQuoteAsset, setRankingQuoteAsset] = useState('USDT');
  const [rankingMinVolume, setRankingMinVolume] = useState('0');
  const [rankingMinPrice, setRankingMinPrice] = useState('');
  const [rankingMaxPrice, setRankingMaxPrice] = useState('');
  const [rankingTopN, setRankingTopN] = useState('10');
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningId, setIsRunningId] = useState<string | null>(null);
  const [isActivatingId, setIsActivatingId] = useState<string | null>(null);
  const [backtestSelection, setBacktestSelection] = useState<BacktestSelection | null>(null);
  const [backtestForm, setBacktestForm] = useState<BacktestForm>(defaultBacktestForm);
  const [backtestRun, setBacktestRun] = useState<BotBacktestRun | null>(null);
  const [backtestTrades, setBacktestTrades] = useState<BotBacktestTrade[]>([]);
  const [isBacktestTradesLoading, setIsBacktestTradesLoading] = useState(false);
  const [backtestTradesError, setBacktestTradesError] = useState<string | null>(null);
  const [isBacktestSubmitting, setIsBacktestSubmitting] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didLoadInitialRanking = useRef(false);

  const clientOptions = useMemo(
    () => [
      { value: '', label: 'Selecione uma carteira' },
      ...clients.map((client) => ({
        value: client.id,
        label: client.name,
      })),
    ],
    [clients]
  );

  const strategyOptions = useMemo(
    () => [
      { value: '', label: 'Estrategia padrao do produto' },
      ...strategies.map((strategy) => ({
        value: strategy.id,
        label: `${strategy.name} v${strategy.version}`,
      })),
    ],
    [strategies]
  );

  const universeBySymbol = useMemo(() => {
    const map = new Map<string, BotMarketUniverseAsset>();
    universeAssets.forEach((asset) => map.set(asset.symbol, asset));
    return map;
  }, [universeAssets]);

  const loadBots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [templatesResult, strategiesResult, instancesResult, clientsResult] = await Promise.all([
      api.getBotTemplates(),
      api.getBotStrategies(),
      api.getBotInstances(),
      api.getClients(),
    ]);
    if (!templatesResult.success || !strategiesResult.success || !instancesResult.success || !clientsResult.success) {
      setError(
        templatesResult.error
        || strategiesResult.error
        || instancesResult.error
        || clientsResult.error
        || 'Nao foi possivel carregar bots'
      );
      setIsLoading(false);
      return;
    }
    setTemplates(templatesResult.data || []);
    setStrategies(strategiesResult.data || []);
    setInstances(instancesResult.data || []);
    setClients(clientsResult.data || []);
    setIsLoading(false);
  }, []);

  const loadMarketRanking = useCallback(async () => {
    setIsRankingLoading(true);
    setError(null);
    const minVolume = Number.parseFloat(rankingMinVolume.replace(',', '.'));
    const minPrice = Number.parseFloat(rankingMinPrice.replace(',', '.'));
    const maxPrice = Number.parseFloat(rankingMaxPrice.replace(',', '.'));
    const result = await api.getBotMarketRanking({
      exchange: rankingExchange,
      market_type: rankingMarketType,
      timeframe: rankingTimeframe,
      direction: rankingDirection,
      top_n: Number(rankingTopN),
      min_quote_volume: Number.isFinite(minVolume) ? minVolume : 0,
      min_price: Number.isFinite(minPrice) ? minPrice : undefined,
      max_price: Number.isFinite(maxPrice) ? maxPrice : undefined,
      quote_asset: rankingQuoteAsset,
    });
    setIsRankingLoading(false);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel carregar scanner de mercado');
      return;
    }
    setMarketRanking(result.data || null);
  }, [rankingDirection, rankingExchange, rankingMarketType, rankingMaxPrice, rankingMinPrice, rankingMinVolume, rankingQuoteAsset, rankingTimeframe, rankingTopN]);

  const loadMarketUniverse = useCallback(async () => {
    const result = await api.getBotMarketUniverse({
      exchange: rankingExchange,
      market_type: rankingMarketType,
      quote_asset: rankingQuoteAsset,
      only_tradeable: true,
      limit: 250,
    });
    if (result.success) {
      setUniverseAssets(result.data || []);
    }
  }, [rankingExchange, rankingMarketType, rankingQuoteAsset]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  useEffect(() => {
    if (didLoadInitialRanking.current) return;
    didLoadInitialRanking.current = true;
    loadMarketRanking();
  }, [loadMarketRanking]);

  useEffect(() => {
    loadMarketUniverse();
  }, [loadMarketUniverse]);

  useEffect(() => {
    if (!backtestRun || !['running', 'queued', 'pending'].includes(String(backtestRun.status).toLowerCase())) {
      return;
    }
    const timer = window.setTimeout(async () => {
      const result = await api.getBotBacktestRun(backtestRun.id);
      if (result.success && result.data) {
        setBacktestRun(result.data);
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [backtestRun]);

  useEffect(() => {
    const runId = backtestRun?.id;
    const runStatus = String(backtestRun?.status || '').toLowerCase();
    if (!runId || runStatus !== 'succeeded') return;
    let cancelled = false;
    setIsBacktestTradesLoading(true);
    setBacktestTradesError(null);
    api.getBotBacktestTrades(runId).then((result) => {
      if (cancelled) return;
      setIsBacktestTradesLoading(false);
      if (result.success) {
        setBacktestTrades(result.data || []);
        return;
      }
      setBacktestTrades([]);
      setBacktestTradesError(result.error || 'Nao foi possivel carregar os trades deste backtest.');
    });
    return () => {
      cancelled = true;
    };
  }, [backtestRun?.id, backtestRun?.status]);

  const getTemplateConfig = (templateId: string): TemplateConfig => (
    configByTemplate[templateId] || defaultTemplateConfig
  );

  const updateTemplateConfig = (templateId: string, patch: Partial<TemplateConfig>) => {
    setConfigByTemplate((current) => ({
      ...current,
      [templateId]: {
        ...defaultTemplateConfig,
        ...(current[templateId] || {}),
        ...patch,
      },
    }));
  };

  const loadClientExchanges = async (templateId: string, clientId: string) => {
    updateTemplateConfig(templateId, { clientId, exchangeId: '' });
    if (!clientId || exchangesByClient[clientId]) return;
    const result = await api.getClientPortfolio(clientId);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel carregar exchanges da carteira');
      return;
    }
    setExchangesByClient((current) => ({
      ...current,
      [clientId]: result.data!.exchanges,
    }));
  };

  const loadSignals = async (instanceId: string) => {
    const result = await api.getBotInstanceSignals(instanceId);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel carregar sinais do bot');
      return;
    }
    setSignalsByInstance((current) => ({
      ...current,
      [instanceId]: result.data || [],
    }));
  };

  const activateBot = async (template: BotTemplate) => {
    setError(null);
    const config = getTemplateConfig(template.id);
    if (!can('bots:activate')) {
      setError('Seu papel atual nao permite ativar bots. Peça para um owner/admin liberar bots:activate ou ativar por voce.');
      return;
    }
    if (!planAllows(activeMembership?.organization.plan, template.required_plan)) {
      setError(`Este bot exige plano ${template.required_plan.toUpperCase()}, mas a conta ativa esta no plano ${normalizePlan(activeMembership?.organization.plan).toUpperCase()}.`);
      return;
    }
    if (!config.clientId) {
      setError('Selecione uma carteira para ativar o bot');
      return;
    }
    const manualSymbols = splitCsv(config.allowedSymbols).map((item) => item.toUpperCase());
    const usesScannerBasket = manualSymbols.length === 0 && config.basketMode === 'scanner';
    const usesExtremeBasket = manualSymbols.length === 0 && config.basketMode === 'market_extremes';
    const rankingSymbols = (marketRanking?.items || []).map((item) => item.base_asset.toUpperCase());
    const selectedExchange = (exchangesByClient[config.clientId] || []).find((exchange) => exchange.id === config.exchangeId);
    const executionExchange = selectedExchange?.exchange?.toLowerCase() || rankingExchange;
    if (usesScannerBasket && (!marketRanking?.snapshot_id || rankingSymbols.length === 0)) {
      setError('Gere ou carregue um ranking antes de ativar o bot com cesta dinamica, ou informe simbolos manuais.');
      return;
    }
    if (usesScannerBasket && selectedExchange && executionExchange !== rankingExchange) {
      setError('O scanner carregado pertence a outra exchange. Aplique filtros para a exchange selecionada no bot antes de ativar.');
      return;
    }
    const allowedSymbols = manualSymbols.length > 0 ? manualSymbols : (usesScannerBasket ? rankingSymbols : []);
    const basketPolicy = usesExtremeBasket
      ? {
          source: 'market_extremes',
          exchange: executionExchange,
          market_type: rankingMarketType,
          quote_asset: rankingQuoteAsset,
          timeframe: config.basketTimeframe,
          refresh_every_days: Math.max(1, Math.floor(asNumber(config.basketRefreshDays, 7))),
          refresh_time: config.basketRefreshTime || '09:00',
          timezone: 'America/Sao_Paulo',
          min_quote_volume: Number.parseFloat(rankingMinVolume.replace(',', '.')) || 0,
          min_price: rankingMinPrice ? Number.parseFloat(rankingMinPrice.replace(',', '.')) : null,
          max_price: rankingMaxPrice ? Number.parseFloat(rankingMaxPrice.replace(',', '.')) : null,
          only_tradeable: true,
          legs: [
            { direction: 'losers', top_n: Math.max(0, Math.floor(asNumber(config.basketTopLosers, 10))) },
            { direction: 'gainers', top_n: Math.max(0, Math.floor(asNumber(config.basketTopGainers, 10))) },
          ].filter((leg) => leg.top_n > 0),
        }
      : undefined;
    setIsActivatingId(template.id);
    const result = await api.createBotInstance({
      template_id: template.id,
      client_id: config.clientId,
      exchange_id: config.exchangeId || null,
      strategy_id: config.strategyId || template.strategy_id || null,
      name: template.name,
      mode: 'paper',
      parameters: template.default_parameters || {},
      risk_config: {
        max_order_usd: asNumber(config.maxOrderUsd, 100),
        max_position_usd: asNumber(config.maxPositionUsd, 1000),
        max_daily_signals: Math.max(0, Math.floor(asNumber(config.maxDailySignals, 20))),
        allowed_symbols: allowedSymbols,
        basket_policy: basketPolicy,
        market_basket: manualSymbols.length > 0
          ? { source: 'manual' }
          : usesExtremeBasket
            ? {
                source: 'market_extremes',
                exchange: executionExchange,
                market_type: rankingMarketType,
                quote_asset: rankingQuoteAsset,
                timeframe: config.basketTimeframe,
              }
            : {
                source: 'market_ranking',
                snapshot_id: marketRanking?.snapshot_id || null,
                exchange: rankingExchange,
                market_type: rankingMarketType,
                timeframe: rankingTimeframe,
                direction: rankingDirection,
                top_n: Number(rankingTopN),
                min_quote_volume: Number.parseFloat(rankingMinVolume.replace(',', '.')) || 0,
                min_price: rankingMinPrice ? Number.parseFloat(rankingMinPrice.replace(',', '.')) : null,
                max_price: rankingMaxPrice ? Number.parseFloat(rankingMaxPrice.replace(',', '.')) : null,
                quote_asset: rankingQuoteAsset,
              },
      },
    });
    setIsActivatingId(null);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel ativar o bot');
      return;
    }
    await loadBots();
  };

  const updateInstanceStatus = async (instance: BotInstance, status: 'active' | 'paused' | 'disabled') => {
    const result = await api.updateBotInstance(instance.id, { status });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel atualizar o bot');
      return;
    }
    await loadBots();
  };

  const runPaper = async (instance: BotInstance) => {
    setIsRunningId(instance.id);
    setError(null);
    const result = await api.runBotInstancePaper(instance.id);
    setIsRunningId(null);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel rodar ciclo paper');
      return;
    }
    await Promise.all([loadSignals(instance.id), loadBots()]);
  };

  const requestLive = async (instance: BotInstance) => {
    const result = await api.requestBotLiveEnable(instance.id, {
      confirm_risk: true,
      reason: 'Solicitado via UI de bots',
    });
    if (!result.success) {
      setError(result.error || 'Live trading bloqueado nesta fase');
      return;
    }
    await loadBots();
  };

  const openBacktest = (instance: BotInstance, symbol: string) => {
    setError(null);
    setBacktestSelection({ instance, symbol });
    setBacktestRun(null);
    setBacktestTrades([]);
    setIsBacktestTradesLoading(false);
    setBacktestTradesError(null);
    setBacktestError(null);
    setBacktestForm(defaultBacktestForm);
  };

  const updateBacktestForm = (patch: Partial<BacktestForm>) => {
    setBacktestForm((current) => ({ ...current, ...patch }));
  };

  const runAssetBacktest = async () => {
    if (!backtestSelection) return;
    setIsBacktestSubmitting(true);
    setError(null);
    setBacktestError(null);
    setBacktestTrades([]);
    setIsBacktestTradesLoading(false);
    setBacktestTradesError(null);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - Math.max(1, Math.floor(asNumber(backtestForm.months, 6))));
    const result = await api.createBotInstanceBacktest(backtestSelection.instance.id, {
      symbol: backtestSelection.symbol,
      timeframe: backtestForm.timeframe,
      initial_capital_usd: asNumber(backtestForm.initialCapitalUsd, 10000),
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      fee_percent: asNumber(backtestForm.feePercent, 0.1),
      slippage_percent: asNumber(backtestForm.slippagePercent, 0.05),
    });
    setIsBacktestSubmitting(false);
    if (!result.success || !result.data) {
      setBacktestError(result.error || 'Nao foi possivel enfileirar o backtest deste ativo');
      return;
    }
    setBacktestRun(result.data);
  };

  return (
    <div className="min-h-screen bg-background-primary p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-overline uppercase tracking-[0.24em] text-accent-blue">Automacao</p>
            <h1 className="mt-2 text-heading-xl text-text-primary">Bots</h1>
            <p className="mt-2 max-w-3xl text-body-sm text-text-secondary">
              Ative bots publicados pela Connectcoin, configure risco por carteira e rode ciclos paper auditaveis.
              O live trading permanece bloqueado ate o executor com reconciliacao ser aprovado.
            </p>
          </div>
          <Badge variant="purple">Operational v1</Badge>
        </div>

        {error && (
          <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-body-sm text-status-error">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['Produtos', templates.length, 'Bots publicados'],
            ['Estrategias', strategies.length, 'Motores disponiveis'],
            ['Instancias', instances.length, 'Bots nesta conta'],
            ['Ativos', instances.filter((instance) => instance.status === 'active').length, 'Rodando em paper'],
          ].map(([label, value, caption]) => (
            <Card key={label} variant="glass" className="p-5">
              <p className="text-caption text-text-muted">{label}</p>
              <p className="mt-2 text-heading-md text-text-primary">{value}</p>
              <p className="mt-1 text-caption text-text-tertiary">{caption}</p>
            </Card>
          ))}
        </div>

        <Card variant="glass">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Scanner de mercado</CardTitle>
              <p className="mt-1 text-caption text-text-muted">
                Ranking de ativos por performance para alimentar cestas de monitoramento dos bots.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={rankingExchange}
                options={[
                  { value: 'bingx', label: 'BingX' },
                  { value: 'bybit', label: 'Bybit' },
                ]}
                onChange={(event) => setRankingExchange(event.target.value)}
                className="h-9 w-28 py-0 text-caption"
              />
              <Select
                value={rankingMarketType}
                options={[
                  { value: 'futures', label: 'Futuros' },
                  { value: 'spot', label: 'Spot' },
                ]}
                onChange={(event) => setRankingMarketType(event.target.value)}
                className="h-9 w-28 py-0 text-caption"
              />
              <Select
                value={rankingQuoteAsset}
                options={[
                  { value: 'USDT', label: 'USDT' },
                  { value: 'USDC', label: 'USDC' },
                  { value: 'USD', label: 'USD' },
                ]}
                onChange={(event) => setRankingQuoteAsset(event.target.value)}
                className="h-9 w-24 py-0 text-caption"
              />
              <Select
                value={rankingTopN}
                options={[
                  { value: '10', label: 'Top 10' },
                  { value: '20', label: 'Top 20' },
                  { value: '50', label: 'Top 50' },
                ]}
                onChange={(event) => setRankingTopN(event.target.value)}
                className="h-9 w-28 py-0 text-caption"
              />
              <Button type="button" size="sm" variant="secondary" onClick={loadMarketRanking}>
                <RefreshCw className="h-3.5 w-3.5" />
                Aplicar filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(['1h', '24h', '7d', '30d'] as RankingTimeframe[]).map((timeframe) => (
                  <button
                    key={timeframe}
                    type="button"
                    onClick={() => setRankingTimeframe(timeframe)}
                    className={`rounded-lg px-3 py-2 text-caption font-semibold transition ${
                      rankingTimeframe === timeframe
                        ? 'bg-accent-blue text-white shadow-sm'
                        : 'border border-border-subtle bg-background-primary text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue'
                    }`}
                  >
                    {timeframe}
                  </button>
                ))}
              </div>
              <div className="flex rounded-xl border border-border-subtle bg-background-primary p-1">
                {([
                  ['gainers', 'Altas', ArrowUpRight],
                  ['losers', 'Quedas', ArrowDownRight],
                ] as const).map(([direction, label, Icon]) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => setRankingDirection(direction)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-caption font-semibold transition ${
                      rankingDirection === direction
                        ? direction === 'gainers'
                          ? 'bg-status-success/15 text-status-success'
                          : 'bg-status-error/15 text-status-error'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <input
                value={rankingMinVolume}
                onChange={(event) => setRankingMinVolume(event.target.value)}
                placeholder="Volume minimo em USDT"
                className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
              />
              <input
                value={rankingMinPrice}
                onChange={(event) => setRankingMinPrice(event.target.value)}
                placeholder="Preco minimo"
                className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
              />
              <input
                value={rankingMaxPrice}
                onChange={(event) => setRankingMaxPrice(event.target.value)}
                placeholder="Preco maximo"
                className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
              />
            </div>
            <div className="mb-4 flex flex-wrap gap-2 text-caption text-text-muted">
              <span className="rounded-lg border border-border-subtle bg-background-primary px-3 py-2">
                Universo elegivel: {universeAssets.length || 'aguardando sync'}
              </span>
              <span className="rounded-lg border border-border-subtle bg-background-primary px-3 py-2">
                Fonte: candles normalizados + snapshots auditaveis
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-background-secondary/50">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[48px_1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_0.8fr] gap-3 border-b border-border-subtle px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  <span>#</span>
                  <span>Ativo</span>
                  <span>Preco</span>
                  <span>1h</span>
                  <span>24h</span>
                  <span>7d</span>
                  <span>30d</span>
                  <span>Volume</span>
                  <span>Fonte</span>
                </div>
                {isRankingLoading && (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-body-sm text-text-muted">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Carregando ranking...
                  </div>
                )}
                {!isRankingLoading && (!marketRanking || marketRanking.items.length === 0) && (
                  <div className="px-4 py-8 text-center">
                    <BarChart3 className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                    <p className="text-body-sm text-text-secondary">Nenhum snapshot de ranking gerado ainda.</p>
                    <p className="mt-1 text-caption text-text-tertiary">
                      Gere candles e snapshots pelo admin para o scanner alimentar a cesta dos bots.
                    </p>
                  </div>
                )}
                {!isRankingLoading && marketRanking?.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[48px_1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_0.8fr] gap-3 border-b border-border-subtle/70 px-4 py-3 text-body-sm last:border-b-0 hover:bg-background-primary/70"
                  >
                    <span className="font-semibold text-text-muted">{item.rank}</span>
                    <div>
                      <p className="font-semibold text-text-primary">{item.base_asset}</p>
                      <p className="text-caption text-text-tertiary">{item.symbol}</p>
                    </div>
                    <span className="font-semibold text-text-primary">{formatCompactUsd(universeBySymbol.get(item.symbol)?.last_price || item.price)}</span>
                    {(['1h', '24h', '7d', '30d'] as RankingTimeframe[]).map((timeframe) => {
                      const universe = universeBySymbol.get(item.symbol);
                      const value = timeframe === '1h'
                        ? universe?.change_1h_percent
                        : timeframe === '24h'
                          ? universe?.change_24h_percent
                          : timeframe === '7d'
                            ? universe?.change_7d_percent
                            : universe?.change_30d_percent;
                      const resolved = value ?? (timeframe === rankingTimeframe ? item.change_percent : null);
                      return (
                        <span
                          key={timeframe}
                          className={`font-semibold ${Number(resolved || 0) >= 0 ? 'text-status-success' : 'text-status-error'}`}
                        >
                          {resolved === null ? '-' : formatPercent(resolved)}
                        </span>
                      );
                    })}
                    <span className="text-text-secondary">{formatCompactNumber(item.quote_volume)}</span>
                    <div className="text-caption text-text-muted">
                      <p className="uppercase">{marketRanking.exchange}</p>
                      <p>{formatDateTime(item.candle_close_time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Catalogo operacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && (
                <p className="py-8 text-center text-body-sm text-text-muted">Carregando bots...</p>
              )}
              {!isLoading && templates.length === 0 && (
                <div className="rounded-xl border border-border-subtle bg-background-secondary/60 p-8 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                  <p className="text-body-sm text-text-secondary">Nenhum bot publicado ainda.</p>
                </div>
              )}
              {templates.map((template) => {
                const config = getTemplateConfig(template.id);
                const supportedExchanges = asStringArray(template.supported_exchanges);
                const supportedAssets = asStringArray(template.supported_assets);
                const supportedExchangeKeys = supportedExchanges.map((item) => item.toLowerCase());
                const compatibleExchanges = (exchangesByClient[config.clientId] || []).filter((exchange) => (
                  exchange.is_active !== false
                  && (supportedExchangeKeys.length === 0 || supportedExchangeKeys.includes(exchange.exchange.toLowerCase()))
                ));
                const supportedExchangeLabel = supportedExchangeKeys.length
                  ? supportedExchangeKeys.map((item) => item.toUpperCase()).join(' ou ')
                  : 'exchange';
                const requiresExchange = supportedExchangeKeys.length > 0;
                const hasManualSymbols = splitCsv(config.allowedSymbols).length > 0;
                const hasScannerBasket = Boolean(marketRanking?.snapshot_id && marketRanking.items.length > 0);
                const needsScannerBasket = !hasManualSymbols && config.basketMode === 'scanner';
                const activationBlockReasons = [
                  !can('bots:activate') ? 'Seu papel atual nao permite ativar bots nesta conta.' : '',
                  !planAllows(activeMembership?.organization.plan, template.required_plan)
                    ? `Este bot exige plano ${template.required_plan.toUpperCase()}; conta ativa: ${normalizePlan(activeMembership?.organization.plan).toUpperCase()}.`
                    : '',
                  !config.clientId ? 'Selecione uma carteira para ativar.' : '',
                  requiresExchange && !config.exchangeId ? `Selecione uma conexao ${supportedExchangeLabel}.` : '',
                  needsScannerBasket && !hasScannerBasket ? 'Carregue um ranking no scanner ou use a cesta automatica.' : '',
                ].filter(Boolean);
                const exchangeOptions = [
                  { value: '', label: supportedExchangeKeys.length ? `Selecione ${supportedExchangeLabel}` : 'Exchange opcional' },
                  ...compatibleExchanges.map((exchange) => ({
                    value: exchange.id,
                    label: `${exchange.label} (${exchange.exchange})`,
                  })),
                ];
                return (
                  <div key={template.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Bot className="h-4 w-4 text-accent-blue" />
                            <h2 className="text-heading-sm text-text-primary">{template.name}</h2>
                            <Badge variant="purple" size="sm">{template.type}</Badge>
                            <Badge variant="blue" size="sm">{template.required_plan}</Badge>
                            {template.strategy_name && <Badge variant="success" size="sm">{template.strategy_name}</Badge>}
                          </div>
                          <p className="mt-2 text-body-sm text-text-secondary">
                            {template.description || 'Bot produto publicado pela plataforma.'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(supportedExchanges.length ? supportedExchanges : ['exchange opcional']).map((item) => (
                              <Badge key={item} variant="default" size="sm">{item}</Badge>
                            ))}
                            {supportedAssets.map((item) => (
                              <Badge key={item} variant="success" size="sm">{item}</Badge>
                            ))}
                          </div>
                          {template.risk_notes && (
                            <p className="mt-3 text-caption text-text-tertiary">{template.risk_notes}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          disabled={
                            activationBlockReasons.length > 0
                            || isActivatingId === template.id
                          }
                          onClick={() => activateBot(template)}
                        >
                          <Zap className="h-4 w-4" />
                          {isActivatingId === template.id ? 'Ativando...' : 'Ativar paper'}
                        </Button>
                      </div>
                      {activationBlockReasons.length > 0 && (
                        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-caption text-status-warning">
                          {activationBlockReasons.join(' ')}
                        </div>
                      )}

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Select
                          value={config.clientId}
                          options={clientOptions}
                          onChange={(event) => loadClientExchanges(template.id, event.target.value)}
                          className="h-10 py-0 text-body-sm"
                        />
                        <Select
                          value={config.exchangeId}
                          options={exchangeOptions}
                          onChange={(event) => updateTemplateConfig(template.id, { exchangeId: event.target.value })}
                          className="h-10 py-0 text-body-sm"
                        />
                        <Select
                          value={config.strategyId}
                          options={strategyOptions}
                          onChange={(event) => updateTemplateConfig(template.id, { strategyId: event.target.value })}
                          className="h-10 py-0 text-body-sm"
                        />
                        <input
                          value={config.maxOrderUsd}
                          onChange={(event) => updateTemplateConfig(template.id, { maxOrderUsd: event.target.value })}
                          placeholder="Max ordem USD"
                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                        <input
                          value={config.maxPositionUsd}
                          onChange={(event) => updateTemplateConfig(template.id, { maxPositionUsd: event.target.value })}
                          placeholder="Max posicao USD"
                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                        <input
                          value={config.maxDailySignals}
                          onChange={(event) => updateTemplateConfig(template.id, { maxDailySignals: event.target.value })}
                          placeholder="Sinais/dia"
                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </div>
                      <input
                        value={config.allowedSymbols}
                        onChange={(event) => updateTemplateConfig(template.id, { allowedSymbols: event.target.value })}
                        placeholder="Simbolos manuais opcionais. Vazio deixa o bot montar a cesta automaticamente. Ex: BTC, ETH, SOL"
                        className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                      {!hasManualSymbols && (
                        <div className="rounded-lg border border-border-subtle bg-background-primary/60 p-3">
                          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-body-sm font-semibold text-text-primary">Cesta automatica do bot</p>
                              <p className="text-caption text-text-tertiary">
                                O bot recalcula os extremos no horario configurado e monitora altas + quedas.
                              </p>
                            </div>
                            <Select
                              value={config.basketMode}
                              options={[
                                { value: 'market_extremes', label: 'Auto: altas + quedas' },
                                { value: 'scanner', label: 'Usar scanner carregado' },
                              ]}
                              onChange={(event) => updateTemplateConfig(template.id, { basketMode: event.target.value as BasketMode })}
                              className="h-9 min-w-[190px] py-0 text-caption"
                            />
                          </div>
                          {config.basketMode === 'market_extremes' ? (
                            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                              <Select
                                value={config.basketTimeframe}
                                options={[
                                  { value: '1h', label: 'Janela 1h' },
                                  { value: '24h', label: 'Janela 24h' },
                                  { value: '7d', label: 'Janela 7d' },
                                  { value: '30d', label: 'Janela 30d' },
                                ]}
                                onChange={(event) => updateTemplateConfig(template.id, { basketTimeframe: event.target.value as RankingTimeframe })}
                                className="h-9 py-0 text-caption"
                              />
                              <input
                                value={config.basketTopLosers}
                                onChange={(event) => updateTemplateConfig(template.id, { basketTopLosers: event.target.value })}
                                placeholder="Top quedas"
                                className="h-9 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
                              />
                              <input
                                value={config.basketTopGainers}
                                onChange={(event) => updateTemplateConfig(template.id, { basketTopGainers: event.target.value })}
                                placeholder="Top altas"
                                className="h-9 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
                              />
                              <input
                                value={config.basketRefreshDays}
                                onChange={(event) => updateTemplateConfig(template.id, { basketRefreshDays: event.target.value })}
                                placeholder="Atualizar a cada dias"
                                className="h-9 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
                              />
                              <input
                                type="time"
                                value={config.basketRefreshTime}
                                onChange={(event) => updateTemplateConfig(template.id, { basketRefreshTime: event.target.value })}
                                className="h-9 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
                              />
                              <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/10 px-3 py-2 text-caption text-accent-blue">
                                Ex.: 10 quedas + 10 altas
                              </div>
                            </div>
                          ) : (
                            <p className="text-caption text-status-warning">
                              Este modo fixa a cesta no ranking que esta carregado na tabela visual agora.
                            </p>
                          )}
                        </div>
                      )}
                      {config.clientId && supportedExchangeKeys.length > 0 && compatibleExchanges.length === 0 && (
                        <p className="text-caption text-status-warning">
                          Esta carteira ainda nao tem conexao ativa {supportedExchangeLabel}. Conecte uma exchange compativel em Positions &gt; Exchanges antes de vincular o bot.
                        </p>
                      )}
                      {needsScannerBasket && !hasScannerBasket && (
                        <p className="text-caption text-status-warning">
                          Carregue um ranking no Scanner de mercado ou informe simbolos manuais para ativar este bot.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <CardTitle>Meus bots operacionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {instances.length === 0 && (
                <div className="rounded-xl border border-border-subtle bg-background-secondary/60 p-8 text-center">
                  <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                  <p className="text-body-sm text-text-secondary">Nenhum bot ativado nesta conta.</p>
                  <p className="mx-auto mt-2 max-w-md text-caption text-text-tertiary">
                    Depois da ativacao, o bot aparece aqui. A cesta de ativos monitorados fica no card da instancia
                    e é preenchida no primeiro ciclo paper ou no proximo ciclo automatico do scheduler.
                  </p>
                </div>
              )}
              {instances.map((instance) => {
                const basket = botBasketView(instance);
                const riskConfig = isRecord(instance.risk_config) ? instance.risk_config : {};
                const latestSignal = (signalsByInstance[instance.id] || [])[0];
                const gateRows = botGateRows(latestSignal);
                return (
                <div key={instance.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-heading-sm text-text-primary">{instance.name}</p>
                    <Badge variant={instance.status === 'active' ? 'success' : instance.status === 'error' ? 'error' : 'yellow'} size="sm">
                      {instance.status}
                    </Badge>
                    <Badge variant="purple" size="sm">{instance.mode}</Badge>
                    {instance.strategy_name && <Badge variant="blue" size="sm">{instance.strategy_name}</Badge>}
                  </div>
                  <p className="mt-2 text-caption text-text-muted">
                    Carteira: {instance.client_name} - Produto: {instance.template_name || 'Template removido'}
                  </p>
                  <p className="mt-1 text-caption text-text-tertiary">
                    Exchange: {instance.exchange_name || 'Nao vinculada'} - Ultimo ciclo: {formatDateTime(instance.last_run_at)}
                  </p>
                  <div className="mt-3 grid gap-3 rounded-lg border border-border-subtle bg-background-primary/60 p-3 text-caption text-text-secondary">
                    <div className="grid gap-2 md:grid-cols-3">
                      <p>Max ordem: {formatCompactUsd(Number(riskConfig.max_order_usd || 0))}</p>
                      <p>Max posicao: {formatCompactUsd(Number(riskConfig.max_position_usd || 0))}</p>
                      <p>Cesta: {basket.source === 'market_extremes' ? 'Auto altas + quedas' : basket.source}</p>
                    </div>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">Ativos monitorados</span>
                        {basket.generatedAt && <Badge variant="blue" size="sm">gerada {formatDateTime(basket.generatedAt)}</Badge>}
                        {basket.nextRefreshAt && <Badge variant="purple" size="sm">proxima {formatDateTime(basket.nextRefreshAt)}</Badge>}
                      </div>
                      {basket.symbols.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {basket.symbols.slice(0, 24).map((symbol) => (
                            <button
                              key={symbol}
                              type="button"
                              onClick={() => openBacktest(instance, symbol)}
                              className="rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[10px] font-semibold text-accent-blue transition hover:border-accent-blue/60 hover:bg-accent-blue/20"
                              title={`Rodar backtest em ${symbol}`}
                            >
                              {symbol}
                            </button>
                          ))}
                          {basket.symbols.length > 24 && <Badge variant="yellow" size="sm">+{basket.symbols.length - 24}</Badge>}
                        </div>
                      ) : (
                        <p className="text-text-tertiary">Cesta ainda nao gerada. O proximo ciclo paper vai resolver os ativos.</p>
                      )}
                    </div>
                    {basket.legs.length > 0 && (
                      <div className="grid gap-2 md:grid-cols-2">
                        {basket.legs.map((leg, index) => (
                          <div key={`${String(leg.direction)}-${index}`} className="rounded-lg border border-border-subtle bg-background-secondary/70 p-2">
                            <p className="font-semibold text-text-primary">
                              {leg.direction === 'losers' ? 'Quedas monitoradas' : 'Altas monitoradas'}
                            </p>
                            <p className="mt-1 text-text-tertiary">
                              {Array.isArray(leg.symbols) ? leg.symbols.slice(0, 8).join(', ') : 'Aguardando snapshot'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">Gates do ultimo ciclo</span>
                        {latestSignal?.symbol && <Badge variant="blue" size="sm">{latestSignal.symbol}</Badge>}
                        {latestSignal?.action && <Badge variant={latestSignal.action === 'buy' ? 'success' : latestSignal.action === 'sell' ? 'error' : 'default'} size="sm">{latestSignal.action}</Badge>}
                      </div>
                      <div className="grid gap-2 md:grid-cols-4">
                        {gateRows.map((gate) => (
                          <div key={gate.label} className="rounded-lg border border-border-subtle bg-background-secondary/70 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-text-primary">{gate.label}</p>
                              <span className={
                                gate.status === 'pass'
                                  ? 'text-status-success'
                                  : gate.status === 'block'
                                    ? 'text-status-error'
                                    : gate.status === 'wait'
                                      ? 'text-status-warning'
                                      : 'text-text-tertiary'
                              }>
                                {gate.status === 'pass' ? 'check' : gate.status === 'block' ? 'block' : gate.status === 'wait' ? 'wait' : 'idle'}
                              </span>
                            </div>
                            <p className="mt-1 text-text-tertiary">{gate.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {instance.last_error && (
                    <p className="mt-2 text-caption text-status-error">{instance.last_error}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isRunningId === instance.id || !can('bots:run')}
                      onClick={() => runPaper(instance)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {isRunningId === instance.id ? 'Rodando...' : 'Rodar paper'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={instance.status === 'active' || !can('bots:edit')}
                      onClick={() => updateInstanceStatus(instance, 'active')}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Ativar status
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={instance.status === 'paused' || !can('bots:edit')}
                      onClick={() => updateInstanceStatus(instance, 'paused')}
                    >
                      <Pause className="h-3.5 w-3.5" />
                      Pausar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={!can('bots:activate')}
                      onClick={() => requestLive(instance)}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Solicitar live
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => loadSignals(instance.id)}
                    >
                      Ver sinais
                    </Button>
                  </div>
                  {(signalsByInstance[instance.id] || []).slice(0, 3).map((signal) => (
                    <div key={signal.id} className="mt-3 rounded-lg border border-border-subtle bg-background-primary/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={signal.action === 'buy' ? 'success' : signal.action === 'sell' ? 'error' : 'default'} size="sm">
                          {signal.action}
                        </Badge>
                        {signal.symbol && <Badge variant="blue" size="sm">{signal.symbol}</Badge>}
                        <span className="text-caption text-text-muted">{formatDateTime(signal.generated_at)}</span>
                      </div>
                      <p className="mt-2 text-caption text-text-secondary">{signal.reason || 'Sem motivo registrado'}</p>
                      <p className="mt-1 text-caption text-text-tertiary">
                        Notional ${signal.notional_usd || 0} - confianca {Math.round((signal.confidence || 0) * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
      {backtestSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border-subtle bg-background-primary shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-background-primary/95 p-5 backdrop-blur">
              <div>
                <p className="text-overline uppercase tracking-[0.22em] text-accent-blue">Backtest institucional</p>
                <h2 className="mt-1 text-heading-md text-text-primary">{backtestSelection.symbol}</h2>
                <p className="mt-1 text-caption text-text-muted">
                  Bot: {backtestSelection.instance.name} - carteira {backtestSelection.instance.client_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBacktestSelection(null)}
                className="rounded-xl border border-border-subtle p-2 text-text-muted transition hover:border-accent-blue/40 hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 xl:grid-cols-[0.72fr_1.28fr]">
              <div className="space-y-4">
                <Card variant="glass" className="overflow-hidden">
                  <div className="border-b border-border-subtle bg-background-secondary/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-body-sm font-semibold text-text-primary">Setup do backtest</p>
                        <p className="mt-1 text-caption text-text-tertiary">Worker isolado, dados da exchange e regras reais do bot.</p>
                      </div>
                      <Badge variant={statusTone(backtestRun?.status)} size="sm">
                        {backtestRun?.status || 'novo'}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-caption text-text-secondary">
                        Timeframe
                        <Select
                          value={backtestForm.timeframe}
                          options={[
                            { value: '1h', label: '1h - investigativo' },
                            { value: '4h', label: '4h - recomendado' },
                            { value: '1d', label: '1d - macro' },
                          ]}
                          onChange={(event) => updateBacktestForm({ timeframe: event.target.value })}
                          className="h-10 py-0"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Janela
                        <div className="relative">
                          <input
                            value={backtestForm.months}
                            onChange={(event) => updateBacktestForm({ months: event.target.value })}
                            className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 pr-16 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.14em] text-text-tertiary">meses</span>
                        </div>
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Capital
                        <input
                          value={backtestForm.initialCapitalUsd}
                          onChange={(event) => updateBacktestForm({ initialCapitalUsd: event.target.value })}
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Taxa %
                        <input
                          value={backtestForm.feePercent}
                          onChange={(event) => updateBacktestForm({ feePercent: event.target.value })}
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Slippage %
                        <input
                          value={backtestForm.slippagePercent}
                          onChange={(event) => updateBacktestForm({ slippagePercent: event.target.value })}
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </label>
                      <div className="rounded-lg border border-border-subtle bg-background-secondary/70 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary">Modelo</p>
                        <p className="mt-1 text-caption font-semibold text-text-primary">Long-only + AlphaTrend stop</p>
                        <p className="mt-1 text-[11px] text-text-tertiary">Short e live seguem bloqueados nesta fase.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="mt-4 w-full"
                      disabled={isBacktestSubmitting || !can('bots:backtest')}
                      onClick={runAssetBacktest}
                    >
                      <BarChart3 className="h-4 w-4" />
                      {isBacktestSubmitting ? 'Enfileirando no worker...' : 'Executar backtest institucional'}
                    </Button>
                    {!can('bots:backtest') && (
                      <p className="mt-2 text-caption text-status-error">Seu papel nao tem permissao bots:backtest.</p>
                    )}
                  </div>
                </Card>

                <Card variant="glass" className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-body-sm font-semibold text-text-primary">Pipeline e qualidade</p>
                    <span className="text-caption text-text-tertiary">{Math.round(Number(backtestRun?.progress || 0))}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-background-secondary">
                    <div
                      className="h-full rounded-full bg-accent-blue transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, Number(backtestRun?.progress || 0)))}%` }}
                    />
                  </div>
                  <div className="mt-4 grid gap-2 text-caption text-text-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <span>Cobertura historica</span>
                      <span className="font-semibold text-text-primary">
                        {backtestRun ? `${Number(backtestRun.data_quality?.period_coverage_percent || 0).toFixed(2)}%` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Velas utilizadas</span>
                      <span className="font-semibold text-text-primary">
                        {backtestRun ? String(backtestRun.metrics?.sample_count || backtestRun.data_quality?.rows_total || 0) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Fonte</span>
                      <span className="font-semibold text-text-primary">
                        {String(backtestRun?.data_quality?.candle_source || backtestRun?.result_summary?.candle_source || 'aguardando')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Anualizacao</span>
                      <span className="font-semibold text-text-primary">
                        {String(backtestRun?.metrics?.annualization_status || 'aguardando')}
                      </span>
                    </div>
                  </div>
                  {backtestError && (
                    <div className="mt-3 rounded-lg border border-status-error/30 bg-status-error/10 p-2 text-caption text-status-error">
                      {backtestError}
                    </div>
                  )}
                  {asStringArray(backtestRun?.data_quality?.warnings).length > 0 && (
                    <div className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-2 text-caption text-status-warning">
                      {asStringArray(backtestRun?.data_quality?.warnings).join(', ')}
                    </div>
                  )}
                  {backtestRun?.error_message && (
                    <div className="mt-3 rounded-lg border border-status-error/30 bg-status-error/10 p-2 text-caption text-status-error">
                      {backtestRun.error_message}
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-text-tertiary">
                    Sharpe e Sortino usam apenas barras em posicao; periodos em caixa diluiriam a volatilidade e inflariam o indice. Taxa livre de risco: 0%.
                  </p>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    { label: 'P&L liquido', key: 'net_pnl_usd', kind: 'usd' as const, good: true },
                    { label: 'ROI', key: 'roi_percent', kind: 'percent' as const, good: true },
                    { label: 'Max DD', key: 'max_drawdown_percent', kind: 'percent' as const, good: false },
                    { label: 'Sharpe', key: 'sharpe_ratio', kind: 'number' as const, good: true },
                  ].map((metric) => {
                    const value = metricRawNumber(backtestRun, metric.key);
                    return (
                      <Card key={metric.key} variant="glass" className="p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary">{metric.label}</p>
                        <p className={`mt-2 text-heading-sm ${metricTone(value, metric.good)}`}>
                          {compactMetricLabel(value, metric.kind)}
                        </p>
                      </Card>
                    );
                  })}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card variant="glass" className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-body-sm font-semibold text-text-primary">Equity curve</p>
                      <Badge variant="blue" size="sm">{backtestRun?.timeframe || backtestForm.timeframe}</Badge>
                    </div>
                    <div className="mt-4 flex h-24 items-end gap-1 rounded-xl border border-border-subtle bg-background-secondary/50 p-3">
                      {curveBars(backtestRun?.equity_curve, 'equity').length ? (
                        curveBars(backtestRun?.equity_curve, 'equity').map((height, index) => (
                          <span
                            key={`${height}-${index}`}
                            className="flex-1 rounded-t bg-accent-blue/70"
                            style={{ height }}
                          />
                        ))
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-caption text-text-tertiary">
                          Aguardando resultado
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card variant="glass" className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-body-sm font-semibold text-text-primary">Drawdown</p>
                      <Badge variant="yellow" size="sm">risco</Badge>
                    </div>
                    <div className="mt-4 flex h-24 items-end gap-1 rounded-xl border border-border-subtle bg-background-secondary/50 p-3">
                      {curveBars(backtestRun?.drawdown_curve, 'drawdown_percent', 56, true).length ? (
                        curveBars(backtestRun?.drawdown_curve, 'drawdown_percent', 56, true).map((height, index) => (
                          <span
                            key={`${height}-${index}`}
                            className="flex-1 rounded-t bg-status-error/60"
                            style={{ height }}
                          />
                        ))
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-caption text-text-tertiary">
                          Aguardando resultado
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <Card variant="glass" className="p-4">
                    <p className="text-body-sm font-semibold text-text-primary">Performance</p>
                    <div className="mt-3 space-y-2 text-caption text-text-secondary">
                      <p className="flex justify-between gap-3"><span>Sortino</span><strong className="text-text-primary">{metricLabel(backtestRun, 'sortino_ratio')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Calmar</span><strong className="text-text-primary">{metricLabel(backtestRun, 'calmar_ratio')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Win rate</span><strong className="text-text-primary">{metricLabel(backtestRun, 'win_rate_percent', 'percent')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Profit factor</span><strong className="text-text-primary">{metricLabel(backtestRun, 'profit_factor')}</strong></p>
                    </div>
                  </Card>
                  <Card variant="glass" className="p-4">
                    <p className="text-body-sm font-semibold text-text-primary">Risco operacional</p>
                    <div className="mt-3 space-y-2 text-caption text-text-secondary">
                      <p className="flex justify-between gap-3"><span>Exposicao</span><strong className="text-text-primary">{metricLabel(backtestRun, 'exposure_percent', 'percent')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Avg bars held</span><strong className="text-text-primary">{metricLabel(backtestRun, 'avg_bars_held')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Worst trade</span><strong className="text-status-error">{metricLabel(backtestRun, 'worst_trade_percent', 'percent')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Recovery</span><strong className="text-text-primary">{metricLabel(backtestRun, 'recovery_factor')}</strong></p>
                    </div>
                  </Card>
                  <Card variant="glass" className="p-4">
                    <p className="text-body-sm font-semibold text-text-primary">Benchmark</p>
                    <div className="mt-3 space-y-2 text-caption text-text-secondary">
                      <p className="flex justify-between gap-3"><span>Buy & hold</span><strong className={metricTone(metricRawNumber(backtestRun, 'buy_hold_roi_percent'))}>{metricLabel(backtestRun, 'buy_hold_roi_percent', 'percent')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Alpha vs hold</span><strong className={metricTone(metricRawNumber(backtestRun, 'alpha_vs_buy_hold_percent'))}>{metricLabel(backtestRun, 'alpha_vs_buy_hold_percent', 'percent')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Expectancy</span><strong className={metricTone(metricRawNumber(backtestRun, 'expectancy_usd'))}>{metricLabel(backtestRun, 'expectancy_usd', 'usd')}</strong></p>
                      <p className="flex justify-between gap-3"><span>Annual return</span><strong className="text-text-primary">{metricLabel(backtestRun, 'annualized_return_percent', 'percent')}</strong></p>
                    </div>
                  </Card>
                </div>

                <Card variant="glass" className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-sm font-semibold text-text-primary">Trades normalizados</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="purple" size="sm">
                        {backtestTrades.length
                          ? `mostrando ${Math.min(backtestTrades.length, 8)} de ${metricNumber(backtestRun, 'trade_count') || backtestTrades.length}`
                          : `${metricNumber(backtestRun, 'trade_count')} trades`}
                      </Badge>
                      {isBacktestTradesLoading && <Badge variant="yellow" size="sm">carregando</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-border-subtle">
                    <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] bg-background-secondary/70 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
                      <span>Periodo</span>
                      <span>Retorno</span>
                      <span>MAE/MFE</span>
                      <span>Saida</span>
                    </div>
                    {backtestTradesError ? (
                      <div className="px-3 py-6 text-center text-caption text-status-error">
                        {backtestTradesError}
                      </div>
                    ) : backtestTrades.length ? (
                      backtestTrades.slice(0, 8).map((trade) => (
                        <div key={trade.id} className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] border-t border-border-subtle px-3 py-2 text-caption text-text-secondary">
                          <span>{formatDateTime(trade.entry_time)} {'->'} {trade.exit_time ? formatDateTime(trade.exit_time) : 'aberto'}</span>
                          <span className={metricTone(Number(trade.return_percent))}>{formatPercent(Number(trade.return_percent))}</span>
                          <span>{formatPercent(Number(trade.mae_percent))} / {formatPercent(Number(trade.mfe_percent))}</span>
                          <span>{trade.exit_reason || '-'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-6 text-center text-caption text-text-tertiary">
                        {backtestRun?.status === 'succeeded' ? 'Nenhum trade foi gerado para esta janela.' : 'Os trades aparecem aqui quando o worker concluir.'}
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-caption text-text-tertiary">
                    Taxas e slippage entram no preco executado e no P&L liquido. MAE/MFE ajudam a avaliar fragilidade e potencial intratrade.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
