'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bot, Pause, Play, RefreshCw, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import {
  api,
  type BotInstance,
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
  const { can } = useAuth();
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
    const config = getTemplateConfig(template.id);
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
                const supportedExchangeKeys = template.supported_exchanges.map((item) => item.toLowerCase());
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
                            {(template.supported_exchanges.length ? template.supported_exchanges : ['exchange opcional']).map((item) => (
                              <Badge key={item} variant="default" size="sm">{item}</Badge>
                            ))}
                            {template.supported_assets.map((item) => (
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
                            !can('bots:activate')
                            || !config.clientId
                            || (requiresExchange && !config.exchangeId)
                            || (needsScannerBasket && !hasScannerBasket)
                          }
                          onClick={() => activateBot(template)}
                        >
                          <Zap className="h-4 w-4" />
                          Ativar paper
                        </Button>
                      </div>

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
                </div>
              )}
              {instances.map((instance) => {
                const basket = botBasketView(instance);
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
                      <p>Max ordem: ${String(instance.risk_config.max_order_usd || 0)}</p>
                      <p>Max posicao: ${String(instance.risk_config.max_position_usd || 0)}</p>
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
                            <Badge key={symbol} variant="default" size="sm">{symbol}</Badge>
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
    </div>
  );
}
