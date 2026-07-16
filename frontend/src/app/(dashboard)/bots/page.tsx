'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bot, Pause, Play, RefreshCw, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import {
  api,
  type BotInstance,
  type BotBacktestChart,
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
  stopModel: StopModel;
  atrStopLength: string;
  atrStopMultiplier: string;
  atrStopBufferPercent: string;
  stopLossPercent: string;
  takeProfitPercent: string;
  breakevenPercent: string;
  trailingStopPercent: string;
  allowedSymbols: string;
  basketMode: BasketMode;
  basketTimeframe: RankingTimeframe;
  basketTopGainers: string;
  basketTopLosers: string;
  basketRefreshDays: string;
  basketRefreshTime: string;
};

type BasketMode = 'market_extremes' | 'scanner' | 'manual';
type StopModel = 'alpha_trend' | 'atr';
type RankingDirection = 'gainers' | 'losers';
type RankingTimeframe = '1h' | '24h' | '7d' | '30d';
type PlanName = 'free' | 'pro' | 'enterprise';
type BacktestForm = {
  timeframe: string;
  months: string;
  initialCapitalUsd: string;
  feePercent: string;
  slippagePercent: string;
  stopModel: StopModel;
  atrStopLength: string;
  atrStopMultiplier: string;
  atrStopBufferPercent: string;
  stopLossPercent: string;
  takeProfitPercent: string;
  breakevenPercent: string;
  trailingStopPercent: string;
};
type BacktestSelection = {
  instance: BotInstance;
  symbol: string;
};
type ChartIndicatorKey = 'bcAlphaTrend' | 'atrStop' | 'ma20' | 'ma50' | 'supportResistance';
type ChartIndicatorState = Record<ChartIndicatorKey, boolean>;
type BacktestCrosshairLegend = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
} | null;
type BasketEditorState = {
  instance: BotInstance;
  value: string;
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
  stopModel: 'atr',
  atrStopLength: '14',
  atrStopMultiplier: '2',
  atrStopBufferPercent: '0.10',
  stopLossPercent: '3',
  takeProfitPercent: '8',
  breakevenPercent: '4',
  trailingStopPercent: '2',
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
  stopModel: 'atr',
  atrStopLength: '14',
  atrStopMultiplier: '2',
  atrStopBufferPercent: '0.10',
  stopLossPercent: '3',
  takeProfitPercent: '8',
  breakevenPercent: '4',
  trailingStopPercent: '2',
};

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBotSymbol(value: string) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[/-]/g, '');
  if (!normalized) return '';
  if (normalized.endsWith('USDT') || normalized.endsWith('USDC') || normalized.endsWith('USD')) {
    return normalized;
  }
  return `${normalized}USDT`;
}

function parseManualSymbols(value: string) {
  return Array.from(new Set(
    splitCsv(value)
      .map((item) => item.trim().toUpperCase().replace(/[/-]/g, ''))
      .filter((item) => item.length >= 2)
      .map(normalizeBotSymbol)
      .filter(Boolean)
  ));
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

function formatHistoryDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  return new Date(value).toLocaleDateString('pt-BR');
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

function formatChartPrice(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '$0';
  const abs = Math.abs(amount);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
}

function formatSignedChartPrice(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '$0';
  if (amount === 0) return '$0';
  return `${amount > 0 ? '+' : '-'}${formatChartPrice(Math.abs(amount))}`;
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

function clampBacktestMonths(value: string) {
  const parsed = Math.floor(asNumber(value, 6));
  return Math.min(18, Math.max(1, Number.isFinite(parsed) ? parsed : 6));
}

function backtestStageLabel(run: BotBacktestRun | null) {
  const diagnostics = isRecord(run?.diagnostics) ? run!.diagnostics : {};
  const dataQuality = isRecord(run?.data_quality) ? run!.data_quality : {};
  const stage = String(diagnostics.stage || dataQuality.stage || run?.status || 'new');
  const labels: Record<string, string> = {
    queued: 'Na fila do worker',
    claimed: 'Worker iniciado',
    preparing_candles: 'Preparando candles da exchange',
    loading_candles: 'Carregando candles normalizados',
    loaded_candles: 'Candles carregados',
    simulating: 'Simulando estrategia',
    completed: 'Concluido',
    running: 'Na fila/rodando',
    failed: 'Falhou',
    succeeded: 'Concluido',
    new: 'Aguardando solicitacao',
  };
  return labels[stage] || stage;
}

function backtestAvailableHistoryLabel(run: BotBacktestRun | null) {
  const dataQuality = isRecord(run?.data_quality) ? run!.data_quality : {};
  const history = isRecord(dataQuality.available_history) ? dataQuality.available_history : {};
  const first = formatHistoryDate(history.first_candle_at);
  const last = formatHistoryDate(history.last_candle_at);
  const rows = Number(history.stored_rows || 0);
  if (first && last) return `${first} ate ${last} (${rows.toLocaleString('pt-BR')} candles)`;
  if (rows > 0) return `${rows.toLocaleString('pt-BR')} candles armazenados`;
  return 'Aguardando ingestao sob demanda';
}

function backtestPreloadLabel(run: BotBacktestRun | null) {
  const dataQuality = isRecord(run?.data_quality) ? run!.data_quality : {};
  const preload = isRecord(dataQuality.preload) ? dataQuality.preload : {};
  const status = String(preload.status || 'aguardando');
  const stored = Number(preload.stored || 0);
  const errors = Array.isArray(preload.errors) ? preload.errors.length : 0;
  if (status === 'completed') return `${stored.toLocaleString('pt-BR')} candles atualizados${errors ? `, ${errors} aviso(s)` : ''}`;
  if (status === 'failed') return 'Falha ao buscar candles da exchange';
  if (status === 'skipped') return 'Sem exchange vinculada para preload';
  return 'Sera executado quando o worker iniciar';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function auditRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function auditNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function auditValueLabel(value: unknown) {
  const parsed = auditNumber(value);
  if (parsed === null) return '-';
  const abs = Math.abs(parsed);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(parsed);
}

function operatorLabel(value: unknown) {
  const normalized = String(value || '').replace(/_/g, ' ');
  return normalized || 'condition';
}

function auditConditions(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function auditConditionLabels(value: unknown) {
  return auditConditions(value).slice(0, 4).map((condition) => {
    const left = auditValueLabel(condition.left_value);
    const right = auditValueLabel(condition.right_value);
    const passed = Boolean(condition.passed);
    return {
      key: `${String(condition.indicator || 'indicator')}:${String(condition.output || 'value')}:${String(condition.operator || '')}`,
      label: `${String(condition.indicator || 'indicador')}.${String(condition.output || 'value')} ${operatorLabel(condition.operator)} ${right}`,
      detail: `valor ${left}`,
      passed,
    };
  });
}

function auditIndicatorLabels(value: unknown) {
  const record = auditRecord(value);
  return Object.entries(record).slice(0, 4).map(([indicatorKey, outputs]) => {
    const outputRecord = auditRecord(outputs);
    const firstOutput = Object.entries(outputRecord)[0];
    const firstValue = firstOutput ? auditRecord(firstOutput[1]).value : null;
    return {
      key: indicatorKey,
      label: `${indicatorKey}${firstOutput ? `.${firstOutput[0]}` : ''}`,
      value: auditValueLabel(firstValue),
    };
  });
}

function auditStopLabels(value: unknown, levels?: unknown) {
  const stop = auditRecord(value);
  const levelRecord = auditRecord(levels);
  const items = [
    ['Stop ativo', stop.active_stop_price ?? levelRecord.active_stop_price],
    ['Fonte', stop.stop_source ?? stop.stop_model],
    ['SL', levelRecord.stop_loss_price],
    ['TP', levelRecord.take_profit_price],
    ['BE', levelRecord.breakeven_price],
    ['Gatilho', levelRecord.latest_low ?? levelRecord.latest_close],
  ];
  return items
    .filter(([, itemValue]) => itemValue !== null && itemValue !== undefined && itemValue !== '')
    .slice(0, 6)
    .map(([label, itemValue]) => ({
      label: String(label),
      value: auditNumber(itemValue) !== null ? auditValueLabel(itemValue) : String(itemValue),
    }));
}

function numericCurvePoints(points: unknown[] | undefined, key: string, transform?: (value: number) => number) {
  const source = Array.isArray(points) ? points : [];
  return source
    .map((item, index) => {
      const value = isRecord(item) ? Number(item[key]) : Number.NaN;
      if (!Number.isFinite(value)) return null;
      return {
        index,
        value: transform ? transform(value) : value,
      };
    })
    .filter((item): item is { index: number; value: number } => Boolean(item));
}

function MiniLineChart({
  points,
  valueKey,
  tone,
  emptyLabel = 'Aguardando resultado',
  transform,
  baselineZero = false,
}: {
  points: unknown[] | undefined;
  valueKey: string;
  tone: 'blue' | 'red';
  emptyLabel?: string;
  transform?: (value: number) => number;
  baselineZero?: boolean;
}) {
  const values = numericCurvePoints(points, valueKey, transform);
  if (values.length < 2) {
    return (
      <div className="flex h-full w-full items-center justify-center text-caption text-text-tertiary">
        {emptyLabel}
      </div>
    );
  }

  const width = 520;
  const height = 150;
  const padX = 10;
  const padY = 12;
  const rawMin = Math.min(...values.map((point) => point.value));
  const rawMax = Math.max(...values.map((point) => point.value));
  const min = baselineZero ? Math.min(rawMin, 0) : rawMin;
  const max = baselineZero ? Math.max(rawMax, 0) : rawMax;
  const range = Math.max(0.000001, max - min);
  const xScale = (index: number) => padX + (index / Math.max(1, values.length - 1)) * (width - padX * 2);
  const yScale = (value: number) => padY + ((max - value) / range) * (height - padY * 2);
  const path = values
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xScale(index).toFixed(2)} ${yScale(point.value).toFixed(2)}`)
    .join(' ');
  const zeroY = yScale(0);
  const showZeroLine = baselineZero || (min <= 0 && max >= 0);
  const stroke = tone === 'blue' ? 'rgb(59 130 246)' : 'rgb(239 68 68)';
  const fill = tone === 'blue' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(239, 68, 68, 0.12)';
  const areaPath = `${path} L ${xScale(values.length - 1).toFixed(2)} ${height - padY} L ${xScale(0).toFixed(2)} ${height - padY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label={valueKey}>
      {showZeroLine && (
        <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="4 4" />
      )}
      <path d={areaPath} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xScale(values.length - 1)} cy={yScale(values[values.length - 1].value)} r="4" fill={stroke} />
    </svg>
  );
}

function BacktestCandleChart({
  chart,
  trades,
  loading,
  error,
  indicators,
}: {
  chart: BotBacktestChart | null;
  trades: BotBacktestTrade[];
  loading: boolean;
  error: string | null;
  indicators: ChartIndicatorState;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const crosshairFrameRef = useRef<number | null>(null);
  const [crosshairLegend, setCrosshairLegend] = useState<BacktestCrosshairLegend>(null);
  const candles = useMemo(() => chart?.candles || [], [chart?.candles]);
  const tradeList = useMemo(() => (chart?.trades?.length ? chart.trades : trades), [chart?.trades, trades]);
  const chartData = useMemo(() => {
    return candles
      .map((candle) => {
        const time = Math.floor(new Date(candle.open_time).getTime() / 1000) as UTCTimestamp;
        return {
          time,
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close),
          volume: Number(candle.volume || 0),
        };
      })
      .filter((candle) => Number.isFinite(candle.time) && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite));
  }, [candles]);
  const movingAverage = useCallback((period: number) => {
    if (chartData.length < period) return [];
    const output: Array<{ time: UTCTimestamp; value: number }> = [];
    let rolling = 0;
    chartData.forEach((candle, index) => {
      rolling += candle.close;
      if (index >= period) rolling -= chartData[index - period].close;
      if (index >= period - 1) output.push({ time: candle.time, value: rolling / period });
    });
    return output;
  }, [chartData]);
  const ma20 = useMemo(() => movingAverage(20), [movingAverage]);
  const ma50 = useMemo(() => movingAverage(50), [movingAverage]);
  const officialBcAlphaTrend = useMemo(() => {
    const points =
      chart?.indicators?.bc_alpha_trend?.series?.stop ||
      chart?.indicators?.bc_alpha_trend?.series?.value ||
      [];
    return points
      .map((point) => {
        const time = Math.floor(new Date(point.time).getTime() / 1000) as UTCTimestamp;
        const value = Number(point.value);
        if (!Number.isFinite(Number(time)) || !Number.isFinite(value)) return null;
        return { time, value };
      })
      .filter((point): point is { time: UTCTimestamp; value: number } => point !== null);
  }, [chart?.indicators]);
  const atrStop = useMemo(() => {
    const points =
      chart?.indicators?.atr_stop?.series?.stop ||
      chart?.indicators?.atr_stop?.series?.value ||
      [];
    return points
      .map((point) => {
        const time = Math.floor(new Date(point.time).getTime() / 1000) as UTCTimestamp;
        const value = Number(point.value);
        if (!Number.isFinite(Number(time)) || !Number.isFinite(value)) return null;
        return { time, value };
      })
      .filter((point): point is { time: UTCTimestamp; value: number } => point !== null);
  }, [chart?.indicators]);
  const bcAlphaTrend = useMemo(() => {
    if (officialBcAlphaTrend.length) return officialBcAlphaTrend;
    const count = chartData.length;
    if (count < 20) return [];

    const atrLength = 14;
    const flowLength = 14;
    const trendOffset = 2;
    const atrMultiplier = 1;
    const flowThreshold = 50;

    const isFiniteNumber = (value: number | null | undefined): value is number =>
      typeof value === 'number' && Number.isFinite(value);
    const rma = (values: number[], length: number) => {
      const output: Array<number | null> = new Array(values.length).fill(null);
      let previous: number | null = null;
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (!Number.isFinite(value)) continue;
        if (previous === null) {
          if (index < length - 1) continue;
          const windowValues = values.slice(index - length + 1, index + 1).filter(Number.isFinite);
          if (windowValues.length < length) continue;
          previous = windowValues.reduce((sum, item) => sum + item, 0) / length;
        } else {
          previous = (previous * (length - 1) + value) / length;
        }
        output[index] = previous;
      }
      return output;
    };

    const trueRanges = chartData.map((candle, index) => {
      const previousClose = index > 0 ? chartData[index - 1].close : candle.close;
      return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
    });
    const atr = rma(trueRanges, atrLength);

    const gains = chartData.map((candle, index) =>
      index === 0 ? 0 : Math.max(candle.close - chartData[index - 1].close, 0)
    );
    const losses = chartData.map((candle, index) =>
      index === 0 ? 0 : Math.max(chartData[index - 1].close - candle.close, 0)
    );
    const avgGain = rma(gains, flowLength);
    const avgLoss = rma(losses, flowLength);
    const rsi = chartData.map((_, index) => {
      const gain = avgGain[index];
      const loss = avgLoss[index];
      if (!isFiniteNumber(gain) || !isFiniteNumber(loss)) return null;
      if (loss === 0) return 100;
      const rs = gain / loss;
      return 100 - 100 / (1 + rs);
    });

    const typicalPrices = chartData.map((candle) => (candle.high + candle.low + candle.close) / 3);
    const rawMoneyFlow = chartData.map((candle, index) => typicalPrices[index] * Math.max(Number(candle.volume || 0), 0));
    const mfi = chartData.map((_, index) => {
      if (index < flowLength) return null;
      let positive = 0;
      let negative = 0;
      for (let cursor = index - flowLength + 1; cursor <= index; cursor += 1) {
        const flow = rawMoneyFlow[cursor] || 0;
        if (typicalPrices[cursor] > typicalPrices[cursor - 1]) positive += flow;
        if (typicalPrices[cursor] < typicalPrices[cursor - 1]) negative += flow;
      }
      if (negative === 0) return positive > 0 ? 100 : null;
      const ratio = positive / negative;
      return 100 - 100 / (1 + ratio);
    });
    const volumeCoverage = chartData.filter((candle) => Number(candle.volume || 0) > 0).length / count;
    const flow = volumeCoverage >= 0.5 ? mfi : rsi;

    const alphaLine: Array<number | null> = new Array(count).fill(null);
    const trend: Array<number | null> = new Array(count).fill(null);
    return chartData
      .map((candle, index) => {
        const atrValue = atr[index];
        const flowValue = flow[index];
        if (!isFiniteNumber(atrValue) || !isFiniteNumber(flowValue)) return null;

        const upSupport = candle.low - atrMultiplier * atrValue;
        const downResistance = candle.high + atrMultiplier * atrValue;
        const previousAlpha = index > 0 ? alphaLine[index - 1] : null;
        alphaLine[index] =
          flowValue >= flowThreshold
            ? Math.max(upSupport, previousAlpha ?? upSupport)
            : Math.min(downResistance, previousAlpha ?? downResistance);

        const reference = index >= trendOffset ? alphaLine[index - trendOffset] : null;
        const previousTrend = index > 0 && trend[index - 1] !== null ? trend[index - 1] : null;
        if (reference === null) {
          trend[index] = previousTrend ?? 0;
        } else if ((alphaLine[index] || 0) > reference) {
          trend[index] = 1;
        } else if ((alphaLine[index] || 0) < reference) {
          trend[index] = -1;
        } else {
          trend[index] = previousTrend ?? 0;
        }

        return alphaLine[index] === null ? null : { time: candle.time, value: alphaLine[index] as number };
      })
      .filter((point): point is { time: UTCTimestamp; value: number } => point !== null);
  }, [chartData, officialBcAlphaTrend]);
  const priceLines = useMemo(() => {
    const recent = chartData.slice(-Math.min(180, chartData.length));
    if (!recent.length) return null;
    return {
      support: Math.min(...recent.map((candle) => candle.low)),
      resistance: Math.max(...recent.map((candle) => candle.high)),
    };
  }, [chartData]);
  const nearestTime = useCallback((iso: string | null) => {
    const rawTime = Math.floor(new Date(iso || '').getTime() / 1000);
    if (!Number.isFinite(rawTime) || !chartData.length) return null;
    const firstTime = Number(chartData[0].time);
    const lastTime = Number(chartData[chartData.length - 1].time);
    const candleGap = chartData.length > 1
      ? Math.max(60, Number(chartData[1].time) - Number(chartData[0].time))
      : 3600;
    const snapTolerance = candleGap * 2;
    if (rawTime < firstTime - snapTolerance || rawTime > lastTime + snapTolerance) {
      return null;
    }
    let left = 0;
    let right = chartData.length - 1;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (chartData[middle].time < rawTime) left = middle + 1;
      else right = middle;
    }
    const candidate = chartData[left];
    const previous = chartData[Math.max(0, left - 1)];
    const best = Math.abs(Number(candidate.time) - rawTime) < Math.abs(Number(previous.time) - rawTime)
      ? candidate
      : previous;
    return Math.abs(Number(best.time) - rawTime) <= snapTolerance ? best.time : null;
  }, [chartData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !chartData.length) return;

    let disposed = false;
    let chartApi: { remove: () => void } | null = null;
    const publishLegend = (legend: BacktestCrosshairLegend) => {
      if (crosshairFrameRef.current !== null) {
        window.cancelAnimationFrame(crosshairFrameRef.current);
      }
      crosshairFrameRef.current = window.requestAnimationFrame(() => {
        if (!disposed) setCrosshairLegend(legend);
        crosshairFrameRef.current = null;
      });
    };

    void import('lightweight-charts').then((charts) => {
      if (disposed || !containerRef.current) return;
      const {
        CandlestickSeries,
        ColorType,
        CrosshairMode,
        LineSeries,
        createChart,
        createSeriesMarkers,
      } = charts;

      const chartApiInstance = createChart(containerRef.current, {
        autoSize: true,
        height: 460,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#64748b',
          fontFamily: 'inherit',
        },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.12)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.16)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(37, 99, 235, 0.45)', labelBackgroundColor: '#2563eb' },
          horzLine: { color: 'rgba(37, 99, 235, 0.45)', labelBackgroundColor: '#2563eb' },
        },
        rightPriceScale: {
          borderColor: 'rgba(148, 163, 184, 0.25)',
          scaleMargins: { top: 0.08, bottom: 0.18 },
        },
        timeScale: {
          borderColor: 'rgba(148, 163, 184, 0.25)',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 8,
          barSpacing: 7,
        },
        localization: {
          priceFormatter: (price: number) => formatChartPrice(price),
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });
      chartApi = chartApiInstance;

      const candleSeries = chartApiInstance.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        priceLineVisible: false,
        lastValueVisible: true,
      });
      candleSeries.setData(chartData);

      if (indicators.bcAlphaTrend && bcAlphaTrend.length) {
        const series = chartApiInstance.addSeries(LineSeries, {
          color: '#8b5cf6',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'BC AlphaTrend',
        });
        series.setData(bcAlphaTrend);
      }

      if (indicators.atrStop && atrStop.length) {
        const series = chartApiInstance.addSeries(LineSeries, {
          color: '#dc2626',
          lineWidth: 2,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'ATR Stop',
        });
        series.setData(atrStop);
      }

      if (indicators.ma20 && ma20.length) {
        const series = chartApiInstance.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'MA20',
        });
        series.setData(ma20);
      }
      if (indicators.ma50 && ma50.length) {
        const series = chartApiInstance.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'MA50',
        });
        series.setData(ma50);
      }

      if (indicators.supportResistance && priceLines) {
        candleSeries.createPriceLine({
          price: priceLines.resistance,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Resistencia',
        });
        candleSeries.createPriceLine({
          price: priceLines.support,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Suporte',
        });
      }

      const markers = tradeList
        .flatMap((trade) => {
          const entryTime = nearestTime(trade.entry_time);
          const exitTime = nearestTime(trade.exit_time);
          const exitColor = Number(trade.net_pnl) >= 0 ? '#10b981' : '#ef4444';
          const items: SeriesMarker<UTCTimestamp>[] = [];
          if (entryTime) {
            items.push({
              time: entryTime,
              position: 'belowBar',
              color: '#3b82f6',
              shape: 'arrowUp',
              text: `Entrada ${formatChartPrice(trade.entry_price)}`,
            });
          }
          if (exitTime) {
            items.push({
              time: exitTime,
              position: 'aboveBar',
              color: exitColor,
              shape: 'arrowDown',
              text: `Saida ${formatPercent(Number(trade.return_percent))} (${formatSignedChartPrice(trade.net_pnl)})`,
            });
          }
          return items;
        })
        .sort((a, b) => Number(a.time) - Number(b.time));
      createSeriesMarkers(candleSeries, markers);

      chartApiInstance.subscribeCrosshairMove((param) => {
        const point = param.seriesData.get(candleSeries) as { open?: number; high?: number; low?: number; close?: number } | undefined;
        if (!param.time || !point || point.close === undefined) {
          publishLegend(null);
          return;
        }
        const timeValue = typeof param.time === 'number' ? new Date(param.time * 1000).toISOString() : String(param.time);
        publishLegend({
          time: formatDateTime(timeValue),
          open: Number(point.open || 0),
          high: Number(point.high || 0),
          low: Number(point.low || 0),
          close: Number(point.close || 0),
        });
      });

      chartApiInstance.timeScale().fitContent();
    });

    return () => {
      disposed = true;
      if (crosshairFrameRef.current !== null) {
        window.cancelAnimationFrame(crosshairFrameRef.current);
        crosshairFrameRef.current = null;
      }
      chartApi?.remove();
    };
  }, [atrStop, bcAlphaTrend, chartData, indicators, ma20, ma50, nearestTime, priceLines, tradeList]);

  if (loading) {
    return (
      <div className="flex h-[460px] items-center justify-center text-caption text-text-tertiary">
        Carregando candles e execucoes...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-xl border border-status-error/30 bg-status-error/10 p-4 text-center text-caption text-status-error">
        {error}
      </div>
    );
  }
  if (chartData.length < 2) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-xl border border-border-subtle bg-background-secondary/50 p-4 text-center text-caption text-text-tertiary">
        Sem candles suficientes para este timeframe visual. Os trades do backtest continuam preservados; carregue candles deste timeframe ou volte para o timeframe original.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-background-secondary/50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 text-caption text-text-tertiary">
          <span>{chartData.length} candles</span>
          <span>{tradeList.length} trades</span>
          <span className="text-accent-blue">Crosshair, zoom e pan nativos</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          {indicators.bcAlphaTrend && <span className="text-accent-purple">BC AlphaTrend</span>}
          {indicators.atrStop && atrStop.length > 0 && <span className="text-status-error">ATR Stop</span>}
          {indicators.ma20 && <span className="text-accent-blue">MA20</span>}
          {indicators.ma50 && <span className="text-status-warning">MA50</span>}
          {indicators.supportResistance && <span className="text-status-success">Suporte</span>}
          {indicators.supportResistance && <span className="text-status-error">Resistencia</span>}
        </div>
      </div>
      <div className="relative rounded-xl border border-border-subtle bg-background-secondary/50 p-2">
        {crosshairLegend && (
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 rounded-lg border border-border-subtle bg-background-primary/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
            <span className="font-semibold text-text-primary">{crosshairLegend.time}</span>
            <span>O {formatCompactUsd(crosshairLegend.open)}</span>
            <span>H {formatCompactUsd(crosshairLegend.high)}</span>
            <span>L {formatCompactUsd(crosshairLegend.low)}</span>
            <span>C {formatCompactUsd(crosshairLegend.close)}</span>
          </div>
        )}
        <div ref={containerRef} className="h-[460px] min-h-[360px] w-full" />
      </div>
      <p className="text-[10px] text-text-tertiary">
        Powered by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="text-accent-blue hover:underline">TradingView</a> Lightweight Charts(TM). Use scroll/pinch para zoom, arraste para navegar no tempo e o crosshair para preco preciso.
        {' '}Para auditoria exata do stop executado, compare no mesmo timeframe usado pelo backtest.
      </p>
    </div>
  );
}

function tradeStats(trades: BotBacktestTrade[]) {
  const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.net_pnl || 0), 0);
  const avgPnl = trades.length ? totalPnl / trades.length : 0;
  const winners = trades.filter((trade) => Number(trade.net_pnl || 0) >= 0).length;
  return {
    totalPnl,
    avgPnl,
    winners,
    losers: Math.max(0, trades.length - winners),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

type BotInstanceAssetView = {
  symbol?: string;
  source?: string;
  bucket?: string;
  playbook?: string;
  status?: string;
  approved_for_live?: boolean;
  origin_rank?: number | null;
  origin_timeframe?: string | null;
  performance_percent?: number | null;
};

function instanceAssets(instance: BotInstance): BotInstanceAssetView[] {
  const rawAssets = (instance as unknown as { assets?: BotInstanceAssetView[] }).assets;
  if (!Array.isArray(rawAssets)) return [];
  return rawAssets
    .map((asset) => ({ ...asset, symbol: normalizeBotSymbol(String(asset.symbol || '')) }))
    .filter((asset) => Boolean(asset.symbol) && String(asset.status || '').toLowerCase() !== 'disabled');
}

function legFromAssets(assets: BotInstanceAssetView[], bucket: 'loser' | 'gainer') {
  const filtered = assets.filter((asset) => String(asset.bucket || '').toLowerCase() === bucket);
  if (!filtered.length) return null;
  return {
    direction: bucket === 'loser' ? 'losers' : 'gainers',
    symbols: filtered.map((asset) => asset.symbol).filter(Boolean),
  };
}

function assetContextLabel(asset: BotInstanceAssetView | undefined) {
  if (!asset) return null;
  const bucket = String(asset.bucket || '').toLowerCase();
  const playbook = String(asset.playbook || '').toLowerCase();
  if (bucket === 'loser') return playbook === 'reversal' ? 'queda/reversao' : 'queda';
  if (bucket === 'gainer') return playbook === 'pullback' ? 'alta/pullback' : 'alta';
  if (String(asset.source || '').toLowerCase() === 'manual') return 'manual';
  return playbook && playbook !== 'neutral' ? playbook : null;
}

function botBasketView(instance: BotInstance) {
  const riskConfig = isRecord(instance.risk_config) ? instance.risk_config : {};
  const activeBasket = isRecord(riskConfig.active_basket) ? riskConfig.active_basket : {};
  const basketPolicy = isRecord(riskConfig.basket_policy) ? riskConfig.basket_policy : {};
  const marketBasket = isRecord(riskConfig.market_basket) ? riskConfig.market_basket : {};
  const assets = instanceAssets(instance);
  const activeSymbols = asStringArray(activeBasket.symbols);
  const manualSymbols = asStringArray(riskConfig.allowed_symbols);
  const assetSymbols = assets.map((asset) => asset.symbol).filter(Boolean) as string[];
  const symbols = assetSymbols.length ? assetSymbols : activeSymbols.length ? activeSymbols : manualSymbols;
  const source = String(activeBasket.source || basketPolicy.source || marketBasket.source || (manualSymbols.length ? 'manual' : 'static'));
  const persistedLegs = [legFromAssets(assets, 'loser'), legFromAssets(assets, 'gainer')].filter(Boolean) as Record<string, unknown>[];
  const legs = persistedLegs.length ? persistedLegs : Array.isArray(activeBasket.legs) ? activeBasket.legs.filter(isRecord) : [];
  return {
    source,
    symbols,
    assets,
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

function latestSignalMap(signals: BotSignal[]) {
  const map = new Map<string, BotSignal>();
  signals.forEach((signal) => {
    const symbol = String(signal.symbol || '').toUpperCase();
    if (symbol && !map.has(symbol)) {
      map.set(symbol, signal);
    }
  });
  return map;
}

function symbolStatus(signal: BotSignal | undefined) {
  if (!signal) {
    return {
      label: 'sem ciclo',
      className: 'border-border-subtle bg-background-secondary/70 text-text-tertiary hover:border-accent-blue/30',
      title: 'Ainda nao existe ciclo paper para este ativo',
    };
  }
  const riskSnapshot = isRecord(signal.risk_snapshot) ? signal.risk_snapshot : {};
  const blocks = asStringArray(riskSnapshot.blocks);
  const warnings = asStringArray(riskSnapshot.data_warnings);
  const action = String(signal.action || 'hold').toLowerCase();
  if (blocks.length) {
    return {
      label: 'bloqueado',
      className: 'border-status-error/30 bg-status-error/10 text-status-error hover:border-status-error/60',
      title: blocks.join(', '),
    };
  }
  if (warnings.length) {
    return {
      label: 'aguardando dados',
      className: 'border-status-warning/30 bg-status-warning/10 text-status-warning hover:border-status-warning/60',
      title: warnings.join(', '),
    };
  }
  if (action === 'buy') {
    return {
      label: 'entrada',
      className: 'border-status-success/30 bg-status-success/10 text-status-success hover:border-status-success/60',
      title: signal.reason || 'Entrada validada pelo motor',
    };
  }
  return {
    label: action,
    className: 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue hover:border-accent-blue/60',
    title: signal.reason || 'Ultimo ciclo sem entrada',
  };
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
  const [isRefreshingBasketId, setIsRefreshingBasketId] = useState<string | null>(null);
  const [isSavingBasketId, setIsSavingBasketId] = useState<string | null>(null);
  const [isActivatingId, setIsActivatingId] = useState<string | null>(null);
  const [backtestSelection, setBacktestSelection] = useState<BacktestSelection | null>(null);
  const [basketEditor, setBasketEditor] = useState<BasketEditorState | null>(null);
  const [basketSearch, setBasketSearch] = useState('');
  const [manualSearchByTemplate, setManualSearchByTemplate] = useState<Record<string, string>>({});
  const [backtestForm, setBacktestForm] = useState<BacktestForm>(defaultBacktestForm);
  const [backtestRun, setBacktestRun] = useState<BotBacktestRun | null>(null);
  const [backtestTrades, setBacktestTrades] = useState<BotBacktestTrade[]>([]);
  const [backtestChart, setBacktestChart] = useState<BotBacktestChart | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState(defaultBacktestForm.timeframe);
  const [chartIndicators, setChartIndicators] = useState<ChartIndicatorState>({
    bcAlphaTrend: true,
    atrStop: defaultBacktestForm.stopModel === 'atr',
    ma20: true,
    ma50: true,
    supportResistance: true,
  });
  const [isBacktestTradesLoading, setIsBacktestTradesLoading] = useState(false);
  const [isBacktestChartLoading, setIsBacktestChartLoading] = useState(false);
  const [backtestTradesError, setBacktestTradesError] = useState<string | null>(null);
  const [backtestChartError, setBacktestChartError] = useState<string | null>(null);
  const [isBacktestSubmitting, setIsBacktestSubmitting] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backtestSelection) return;
    setChartIndicators((current) => ({
      ...current,
      atrStop: backtestForm.stopModel === 'atr',
      bcAlphaTrend: backtestForm.stopModel === 'alpha_trend' ? true : current.bcAlphaTrend,
    }));
  }, [backtestForm.stopModel, backtestSelection]);
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
    universeAssets.forEach((asset) => map.set(normalizeBotSymbol(asset.symbol), asset));
    return map;
  }, [universeAssets]);

  const universeSymbolSet = useMemo(() => new Set(universeAssets.map((asset) => normalizeBotSymbol(asset.symbol)).filter(Boolean)), [universeAssets]);

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

  useEffect(() => {
    const runId = backtestRun?.id;
    const runStatus = String(backtestRun?.status || '').toLowerCase();
    if (!runId || runStatus !== 'succeeded') return;
    let cancelled = false;
    setIsBacktestChartLoading(true);
    setBacktestChartError(null);
    api.getBotBacktestChart(runId, chartTimeframe).then((result) => {
      if (cancelled) return;
      setIsBacktestChartLoading(false);
      if (result.success && result.data) {
        setBacktestChart(result.data);
        return;
      }
      setBacktestChart(null);
      setBacktestChartError(result.error || 'Nao foi possivel carregar o grafico de execucoes.');
    });
    return () => {
      cancelled = true;
    };
  }, [backtestRun?.id, backtestRun?.status, chartTimeframe]);

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
    const result = await api.getBotInstanceSignals(instanceId, 100);
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
    const manualSymbols = parseManualSymbols(config.allowedSymbols);
    const usesManualBasket = config.basketMode === 'manual';
    const usesScannerBasket = config.basketMode === 'scanner';
    const usesExtremeBasket = config.basketMode === 'market_extremes';
    const rankingSymbols = (marketRanking?.items || []).map((item) => item.base_asset.toUpperCase());
    const selectedExchange = (exchangesByClient[config.clientId] || []).find((exchange) => exchange.id === config.exchangeId);
    const executionExchange = selectedExchange?.exchange?.toLowerCase() || rankingExchange;
    if (usesManualBasket && manualSymbols.length === 0) {
      setError('Informe os ativos que o bot deve monitorar no modo manual.');
      return;
    }
    if (usesManualBasket) {
      const invalidManualSymbols = manualSymbols.filter((symbol) => !universeSymbolSet.has(symbol));
      if (invalidManualSymbols.length > 0) {
        setError(`Ativos fora do universo carregado: ${invalidManualSymbols.slice(0, 6).join(', ')}. Selecione ativos pela busca para evitar simbolos inexistentes.`);
        return;
      }
    }
    if (usesScannerBasket && (!marketRanking?.snapshot_id || rankingSymbols.length === 0)) {
      setError('Gere ou carregue um ranking antes de ativar o bot com cesta dinamica, ou informe simbolos manuais.');
      return;
    }
    if (usesScannerBasket && selectedExchange && executionExchange !== rankingExchange) {
      setError('O scanner carregado pertence a outra exchange. Aplique filtros para a exchange selecionada no bot antes de ativar.');
      return;
    }
    const allowedSymbols = usesManualBasket ? manualSymbols : (usesScannerBasket ? rankingSymbols : []);
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
        stop_model: config.stopModel,
        atr_stop_length: Math.max(1, Math.floor(asNumber(config.atrStopLength, 14))),
        atr_stop_multiplier: asNumber(config.atrStopMultiplier, 2),
        atr_stop_buffer_percent: Math.max(0, asNumber(config.atrStopBufferPercent, 0.1)),
        stop_loss_percent: Math.max(0, asNumber(config.stopLossPercent, 3)),
        take_profit_percent: Math.max(0, asNumber(config.takeProfitPercent, 8)),
        breakeven_activation_percent: Math.max(0, asNumber(config.breakevenPercent, 4)),
        trailing_stop_percent: Math.max(0, asNumber(config.trailingStopPercent, 2)),
        allowed_symbols: allowedSymbols,
        basket_policy: basketPolicy,
        market_basket: usesManualBasket
          ? { source: 'manual', selection_mode: 'operator', symbols: manualSymbols }
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
    const result = await api.runBotInstancePaperBasket(instance.id);
    setIsRunningId(null);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel rodar a cesta paper');
      return;
    }
    if (result.data && result.data.skipped_count > 0) {
      setError(`Cesta rodada parcialmente: ${result.data.run_count}/${result.data.symbol_count} ativos avaliados; ${result.data.skipped_count} aguardam mais dados.`);
    }
    await Promise.all([loadSignals(instance.id), loadBots()]);
  };

  const refreshBasket = async (instance: BotInstance) => {
    setIsRefreshingBasketId(instance.id);
    setError(null);
    const result = await api.refreshBotInstanceBasket(instance.id);
    setIsRefreshingBasketId(null);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel recalcular a cesta do bot');
      return;
    }
    await loadBots();
  };

  const openBasketEditor = (instance: BotInstance) => {
    const basket = botBasketView(instance);
    setBasketSearch('');
    setBasketEditor({
      instance,
      value: basket.symbols.join(', '),
    });
  };

  const basketEditorSymbols = basketEditor ? splitCsv(basketEditor.value).map(normalizeBotSymbol).filter(Boolean) : [];

  const toggleBasketEditorSymbol = (symbol: string) => {
    if (!basketEditor) return;
    const normalized = normalizeBotSymbol(symbol);
    const current = new Set(splitCsv(basketEditor.value).map(normalizeBotSymbol).filter(Boolean));
    if (current.has(normalized)) {
      current.delete(normalized);
    } else {
      current.add(normalized);
    }
    setBasketEditor({
      ...basketEditor,
      value: Array.from(current).join(', '),
    });
  };

  const saveBasketSelection = async () => {
    if (!basketEditor) return;
    const parsedSymbols = parseManualSymbols(basketEditor.value);
    const invalidSymbols = parsedSymbols.filter((symbol) => !universeSymbolSet.has(symbol));
    if (invalidSymbols.length) {
      setError(`Ativos fora do universo carregado: ${invalidSymbols.slice(0, 6).join(', ')}. Use a busca/Top 50 para selecionar ativos reais.`);
      return;
    }
    const symbols = parsedSymbols;
    if (!symbols.length) {
      setError('Escolha pelo menos um ativo para deixar o bot em modo manual.');
      return;
    }
    const currentRiskConfig = isRecord(basketEditor.instance.risk_config) ? basketEditor.instance.risk_config : {};
    const nextRiskConfig = {
      ...currentRiskConfig,
      allowed_symbols: symbols,
      basket_policy: null,
      market_basket: {
        source: 'manual',
        selection_mode: 'operator',
        symbols,
      },
      active_basket: {
        source: 'manual',
        selection_mode: 'operator',
        symbols,
        symbol_count: symbols.length,
        generated_at: new Date().toISOString(),
      },
    };
    setIsSavingBasketId(basketEditor.instance.id);
    setError(null);
    const result = await api.updateBotInstance(basketEditor.instance.id, { risk_config: nextRiskConfig });
    setIsSavingBasketId(null);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel salvar a cesta manual do bot');
      return;
    }
    setBasketSearch('');
    setBasketEditor(null);
    await loadBots();
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
    const riskConfig = isRecord(instance.risk_config) ? instance.risk_config : {};
    const inheritedBacktestForm: BacktestForm = {
      ...defaultBacktestForm,
      stopModel: String(riskConfig.stop_model || defaultBacktestForm.stopModel) === 'atr' ? 'atr' : 'alpha_trend',
      atrStopLength: String(riskConfig.atr_stop_length || defaultBacktestForm.atrStopLength),
      atrStopMultiplier: String(riskConfig.atr_stop_multiplier || defaultBacktestForm.atrStopMultiplier),
      atrStopBufferPercent: String(riskConfig.atr_stop_buffer_percent ?? defaultBacktestForm.atrStopBufferPercent),
      stopLossPercent: String(riskConfig.stop_loss_percent ?? defaultBacktestForm.stopLossPercent),
      takeProfitPercent: String(riskConfig.take_profit_percent ?? defaultBacktestForm.takeProfitPercent),
      breakevenPercent: String(riskConfig.breakeven_activation_percent ?? defaultBacktestForm.breakevenPercent),
      trailingStopPercent: String(riskConfig.trailing_stop_percent ?? defaultBacktestForm.trailingStopPercent),
    };
    setBacktestSelection({ instance, symbol });
    setBacktestRun(null);
    setBacktestTrades([]);
    setBacktestChart(null);
    setIsBacktestTradesLoading(false);
    setIsBacktestChartLoading(false);
    setBacktestTradesError(null);
    setBacktestChartError(null);
    setBacktestError(null);
    setBacktestForm(inheritedBacktestForm);
    setChartTimeframe(inheritedBacktestForm.timeframe);
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
    setBacktestChart(null);
    setIsBacktestTradesLoading(false);
    setIsBacktestChartLoading(false);
    setBacktestTradesError(null);
    setBacktestChartError(null);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    const months = clampBacktestMonths(backtestForm.months);
    if (String(months) !== backtestForm.months) {
      updateBacktestForm({ months: String(months) });
    }
    periodStart.setMonth(periodStart.getMonth() - months);
    const result = await api.createBotInstanceBacktest(backtestSelection.instance.id, {
      symbol: backtestSelection.symbol,
      timeframe: backtestForm.timeframe,
      initial_capital_usd: asNumber(backtestForm.initialCapitalUsd, 10000),
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      fee_percent: asNumber(backtestForm.feePercent, 0.1),
      slippage_percent: asNumber(backtestForm.slippagePercent, 0.05),
      risk_overrides: {
        stop_model: backtestForm.stopModel,
        atr_stop_length: Math.max(1, Math.floor(asNumber(backtestForm.atrStopLength, 14))),
        atr_stop_multiplier: asNumber(backtestForm.atrStopMultiplier, 2),
        atr_stop_buffer_percent: Math.max(0, asNumber(backtestForm.atrStopBufferPercent, 0.1)),
        stop_loss_percent: Math.max(0, asNumber(backtestForm.stopLossPercent, 3)),
        take_profit_percent: Math.max(0, asNumber(backtestForm.takeProfitPercent, 8)),
        breakeven_activation_percent: Math.max(0, asNumber(backtestForm.breakevenPercent, 4)),
        trailing_stop_percent: Math.max(0, asNumber(backtestForm.trailingStopPercent, 2)),
      },
    });
    setIsBacktestSubmitting(false);
    if (!result.success || !result.data) {
      setBacktestError(result.error || 'Nao foi possivel enfileirar o backtest deste ativo');
      return;
    }
    setChartTimeframe(result.data.timeframe || backtestForm.timeframe);
    setBacktestRun(result.data);
  };

  const visibleInstances = instances.filter((instance) => instance.status !== 'disabled');
  const displayedBacktestTrades = backtestChart?.trades?.length ? backtestChart.trades : backtestTrades;
  const backtestTradeStats = tradeStats(displayedBacktestTrades);

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
            ['Instancias', visibleInstances.length, 'Bots nesta conta'],
            ['Ativos', visibleInstances.filter((instance) => instance.status === 'active').length, 'Rodando em paper'],
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
                const hasManualSymbols = parseManualSymbols(config.allowedSymbols).length > 0;
                const needsManualBasket = config.basketMode === 'manual' && !hasManualSymbols;
                const hasScannerBasket = Boolean(marketRanking?.snapshot_id && marketRanking.items.length > 0);
                const needsScannerBasket = config.basketMode === 'scanner';
                const selectedStrategyId = config.strategyId || template.strategy_id || '';
                const matchingInstance = instances.find((instance) => (
                  instance.template_id === template.id
                  && instance.client_id === config.clientId
                  && (instance.exchange_id || '') === (config.exchangeId || '')
                  && (instance.strategy_id || '') === selectedStrategyId
                  && instance.mode === 'paper'
                  && !instance.live_enabled
                  && instance.status !== 'disabled'
                ));
                const selectedClientName = clients.find((client) => client.id === config.clientId)?.name || 'Carteira nao selecionada';
                const selectedExchangeName = compatibleExchanges.find((exchange) => exchange.id === config.exchangeId)?.label || (requiresExchange ? 'Exchange nao selecionada' : 'Exchange opcional');
                const selectedStrategyName = strategies.find((strategy) => strategy.id === selectedStrategyId)?.name || template.strategy_name || 'Estrategia padrao';
                const manualSymbols = parseManualSymbols(config.allowedSymbols);
                const manualSymbolSet = new Set(manualSymbols);
                const manualSearch = manualSearchByTemplate[template.id] || '';
                const manualSearchTerm = manualSearch.trim().toUpperCase().replace(/[/-]/g, '');
                const manualSuggestions = manualSearch
                  ? universeAssets
                      .map((asset) => ({
                        asset,
                        symbol: normalizeBotSymbol(asset.symbol),
                      }))
                      .filter(({ asset, symbol }) => (
                        symbol
                        && !manualSymbolSet.has(symbol)
                        && (
                          symbol.includes(manualSearchTerm)
                          || String(asset.base_asset || '').toUpperCase().includes(manualSearchTerm)
                          || String(asset.display_name || '').toUpperCase().includes(manualSearchTerm)
                        )
                      ))
                      .slice(0, 8)
                  : [];
                const addManualSymbol = (symbol: string) => {
                  const normalized = normalizeBotSymbol(symbol);
                  if (!normalized || !universeSymbolSet.has(normalized)) return;
                  const next = new Set(manualSymbols);
                  next.add(normalized);
                  updateTemplateConfig(template.id, { allowedSymbols: Array.from(next).join(', ') });
                  setManualSearchByTemplate((current) => ({ ...current, [template.id]: '' }));
                };
                const activationBlockReasons = [
                  !can('bots:activate') ? 'Seu papel atual nao permite ativar bots nesta conta.' : '',
                  !planAllows(activeMembership?.organization.plan, template.required_plan)
                    ? `Este bot exige plano ${template.required_plan.toUpperCase()}; conta ativa: ${normalizePlan(activeMembership?.organization.plan).toUpperCase()}.`
                    : '',
                  !config.clientId ? 'Selecione uma carteira para ativar.' : '',
                  requiresExchange && !config.exchangeId ? `Selecione uma conexao ${supportedExchangeLabel}.` : '',
                  needsManualBasket ? 'Informe os ativos do modo manual.' : '',
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
                          {isActivatingId === template.id
                            ? 'Salvando...'
                            : matchingInstance
                              ? 'Atualizar configuracao'
                              : 'Configurar paper'}
                        </Button>
                      </div>
                      <div className="rounded-lg border border-border-subtle bg-background-primary/60 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
                          <Badge variant={matchingInstance ? 'blue' : 'default'} size="sm">
                            {matchingInstance ? 'Atualiza instancia existente' : 'Nova instancia paper'}
                          </Badge>
                          <span>{selectedClientName}</span>
                          <span className="text-text-muted">/</span>
                          <span>{selectedExchangeName}</span>
                          <span className="text-text-muted">/</span>
                          <span>{selectedStrategyName}</span>
                          {matchingInstance && (
                            <>
                              <span className="text-text-muted">/</span>
                              <span>Status: {matchingInstance.status}</span>
                            </>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-text-tertiary">
                          A instancia operacional e separada por carteira, exchange, estrategia e modo. Para criar outra configuracao, altere uma dessas escolhas.
                        </p>
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
                      <div className="rounded-xl border border-border-subtle bg-background-primary/60 p-4">
                        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px] lg:items-end">
                          <div>
                            <p className="text-body-sm font-semibold text-text-primary">Risco e stop operacional</p>
                            <p className="text-caption text-text-tertiary">
                              O paper e o backtest usam o mesmo modelo de stop. O trailing nunca aumenta o risco inicial.
                            </p>
                          </div>
                          <Select
                            value={config.stopModel}
                            options={[
                              { value: 'alpha_trend', label: 'Stop AlphaTrend' },
                              { value: 'atr', label: 'Stop ATR' },
                            ]}
                            onChange={(event) => updateTemplateConfig(template.id, { stopModel: event.target.value as StopModel })}
                            className="h-10 min-w-0 py-0 text-caption"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            ATR periodo
                            <input
                              value={config.atrStopLength}
                              onChange={(event) => updateTemplateConfig(template.id, { atrStopLength: event.target.value })}
                              disabled={config.stopModel !== 'atr'}
                              className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue disabled:opacity-50"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            ATR multiplicador
                            <input
                              value={config.atrStopMultiplier}
                              onChange={(event) => updateTemplateConfig(template.id, { atrStopMultiplier: event.target.value })}
                              disabled={config.stopModel !== 'atr'}
                              className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue disabled:opacity-50"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            Buffer ATR %
                            <input
                              value={config.atrStopBufferPercent}
                              onChange={(event) => updateTemplateConfig(template.id, { atrStopBufferPercent: event.target.value })}
                              disabled={config.stopModel !== 'atr'}
                              placeholder="0.10"
                              className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue disabled:opacity-50"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            Stop loss %
                            <input
                              value={config.stopLossPercent}
                              onChange={(event) => updateTemplateConfig(template.id, { stopLossPercent: event.target.value })}
                              placeholder="3"
                              className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            Take profit %
                            <input
                              value={config.takeProfitPercent}
                              onChange={(event) => updateTemplateConfig(template.id, { takeProfitPercent: event.target.value })}
                              placeholder="8"
                              className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            Breakeven apos %
                            <input
                              value={config.breakevenPercent}
                              onChange={(event) => updateTemplateConfig(template.id, { breakevenPercent: event.target.value })}
                              placeholder="4"
                              className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            Trailing %
                            <input
                              value={config.trailingStopPercent}
                              onChange={(event) => updateTemplateConfig(template.id, { trailingStopPercent: event.target.value })}
                              placeholder="0 desliga"
                              className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-background-primary/60 p-4">
                          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_240px] lg:items-end">
                            <div>
                              <p className="text-body-sm font-semibold text-text-primary">Modo da cesta do bot</p>
                              <p className="text-caption text-text-tertiary">
                                Escolha se o bot monta a cesta automaticamente ou se o operador define exatamente os ativos.
                              </p>
                            </div>
                            <Select
                              value={config.basketMode}
                              options={[
                                { value: 'market_extremes', label: 'Auto: altas + quedas' },
                                { value: 'scanner', label: 'Usar scanner carregado' },
                                { value: 'manual', label: 'Manual: operador escolhe' },
                              ]}
                              onChange={(event) => updateTemplateConfig(template.id, { basketMode: event.target.value as BasketMode })}
                              className="h-10 min-w-0 py-0 text-caption"
                            />
                          </div>
                          {config.basketMode === 'manual' ? (
                            <div className="grid gap-2">
                              <input
                                value={manualSearch}
                                onChange={(event) => setManualSearchByTemplate((current) => ({ ...current, [template.id]: event.target.value }))}
                                onKeyDown={(event) => {
                                  if (event.key !== 'Enter') return;
                                  event.preventDefault();
                                  if (manualSuggestions[0]) {
                                    addManualSymbol(manualSuggestions[0].symbol);
                                  }
                                }}
                                placeholder="Digite para buscar. Ex: b, btc, eth, sol"
                                className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                              />
                              {manualSuggestions.length > 0 && (
                                <div className="rounded-lg border border-border-subtle bg-background-secondary/70 p-2">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                                      Ativos encontrados
                                    </span>
                                    <Badge variant="default" size="sm">{manualSuggestions.length}</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {manualSuggestions.map(({ asset, symbol }) => (
                                      <button
                                        key={symbol}
                                        type="button"
                                        onClick={() => addManualSymbol(symbol)}
                                        className="rounded-lg border border-border-subtle bg-background-primary px-3 py-2 text-left text-[10px] font-semibold text-text-secondary transition hover:border-accent-blue/50 hover:text-accent-blue"
                                        title={`Adicionar ${symbol}`}
                                      >
                                        <span className="block text-text-primary">{asset.base_asset || symbol.replace(/USDT$/, '')}</span>
                                        <span className="block text-text-tertiary">{symbol}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {manualSymbols.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {manualSymbols.map((symbol) => (
                                    <button
                                      key={symbol}
                                      type="button"
                                      onClick={() => {
                                        const next = manualSymbols.filter((item) => item !== symbol);
                                        updateTemplateConfig(template.id, { allowedSymbols: next.join(', ') });
                                      }}
                                      className="rounded-md border border-accent-blue/30 bg-accent-blue/10 px-2 py-1 text-[10px] font-semibold text-accent-blue transition hover:border-status-error/40 hover:text-status-error"
                                      title={`Remover ${symbol}`}
                                    >
                                      {symbol} x
                                    </button>
                                  ))}
                                </div>
                              )}
                              <p className="text-caption text-text-tertiary">
                                Neste modo o bot nao recalcula extremos. Ele roda paper e backtest somente nos ativos selecionados acima.
                              </p>
                            </div>
                          ) : config.basketMode === 'market_extremes' ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                Janela do ranking
                                <Select
                                  value={config.basketTimeframe}
                                  options={[
                                    { value: '1h', label: '1 hora' },
                                    { value: '24h', label: '24 horas' },
                                    { value: '7d', label: '7 dias' },
                                    { value: '30d', label: '30 dias' },
                                  ]}
                                  onChange={(event) => updateTemplateConfig(template.id, { basketTimeframe: event.target.value as RankingTimeframe })}
                                  className="h-10 min-w-0 py-0 text-caption"
                                />
                              </label>
                              <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                Top quedas
                                <input
                                  value={config.basketTopLosers}
                                  onChange={(event) => updateTemplateConfig(template.id, { basketTopLosers: event.target.value })}
                                  placeholder="10"
                                  className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                                />
                              </label>
                              <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                Top altas
                                <input
                                  value={config.basketTopGainers}
                                  onChange={(event) => updateTemplateConfig(template.id, { basketTopGainers: event.target.value })}
                                  placeholder="10"
                                  className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                                />
                              </label>
                              <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                Recalcular a cada
                                <input
                                  value={config.basketRefreshDays}
                                  onChange={(event) => updateTemplateConfig(template.id, { basketRefreshDays: event.target.value })}
                                  placeholder="7 dias"
                                  className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                                />
                              </label>
                              <label className="grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                Horario
                                <input
                                  type="time"
                                  value={config.basketRefreshTime}
                                  onChange={(event) => updateTemplateConfig(template.id, { basketRefreshTime: event.target.value })}
                                  className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-background-primary px-3 text-caption normal-case tracking-normal text-text-primary outline-none focus:border-accent-blue"
                                />
                              </label>
                              <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/10 px-3 py-2 text-caption text-accent-blue">
                                Ex.: 10 quedas + 10 altas, recalculo semanal as 09:00.
                              </div>
                            </div>
                          ) : (
                            <p className="text-caption text-status-warning">
                              Este modo fixa a cesta no ranking que esta carregado na tabela visual agora.
                            </p>
                          )}
                        </div>
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
              {visibleInstances.length === 0 && (
                <div className="rounded-xl border border-border-subtle bg-background-secondary/60 p-8 text-center">
                  <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                  <p className="text-body-sm text-text-secondary">Nenhum bot ativado nesta conta.</p>
                  <p className="mx-auto mt-2 max-w-md text-caption text-text-tertiary">
                    Depois da ativacao, o bot aparece aqui. A cesta de ativos monitorados fica no card da instancia
                    e é preenchida no primeiro ciclo paper ou no proximo ciclo automatico do scheduler.
                  </p>
                </div>
              )}
              {visibleInstances.map((instance) => {
                const basket = botBasketView(instance);
                const riskConfig = isRecord(instance.risk_config) ? instance.risk_config : {};
                const instanceSignals = signalsByInstance[instance.id] || [];
                const latestSignal = instanceSignals[0];
                const signalBySymbol = latestSignalMap(instanceSignals);
                const assetsBySymbol = new Map(basket.assets.map((asset) => [String(asset.symbol || ''), asset]));
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
                    <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                      <p>Max ordem: {formatCompactUsd(Number(riskConfig.max_order_usd || 0))}</p>
                      <p>Max posicao: {formatCompactUsd(Number(riskConfig.max_position_usd || 0))}</p>
                      <p>
                        Stop: {String(riskConfig.stop_model || 'atr') === 'atr'
                          ? `ATR ${riskConfig.atr_stop_length || 14}x${riskConfig.atr_stop_multiplier || 2} - ${riskConfig.atr_stop_buffer_percent ?? 0.1}%`
                          : 'AlphaTrend'}
                      </p>
                      <p>
                        SL/TP: {Number(riskConfig.stop_loss_percent || 0)}% / {Number(riskConfig.take_profit_percent || 0)}%
                      </p>
                      <p>Breakeven: {Number(riskConfig.breakeven_activation_percent || 0)}%</p>
                      <p>Trailing: {Number(riskConfig.trailing_stop_percent || 0)}%</p>
                      <p>
                        Cesta: {basket.source === 'market_extremes'
                          ? 'Auto altas + quedas'
                          : basket.source === 'manual'
                            ? 'Manual do operador'
                            : basket.source}
                      </p>
                    </div>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">Ativos monitorados</span>
                        {basket.generatedAt && <Badge variant="blue" size="sm">gerada {formatDateTime(basket.generatedAt)}</Badge>}
                        {basket.nextRefreshAt && <Badge variant="purple" size="sm">proxima {formatDateTime(basket.nextRefreshAt)}</Badge>}
                      </div>
                      {basket.symbols.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {basket.symbols.slice(0, 24).map((symbol) => {
                            const status = symbolStatus(signalBySymbol.get(symbol));
                            const asset = assetsBySymbol.get(symbol);
                            const contextLabel = assetContextLabel(asset);
                            return (
                              <button
                                key={symbol}
                                type="button"
                                onClick={() => openBacktest(instance, symbol)}
                                className={`rounded-md border px-2 py-1 text-left text-[10px] font-semibold transition ${status.className}`}
                                title={`${symbol}: ${status.title}. Clique para backtest.`}
                              >
                                <span>{symbol}</span>
                                <span className="ml-1 opacity-70">{status.label}</span>
                                {contextLabel && (
                                  <span className="ml-1 rounded bg-background-primary/80 px-1 uppercase tracking-[0.12em] opacity-70">
                                    {contextLabel}
                                  </span>
                                )}
                                {asset?.approved_for_live && (
                                  <span className="ml-1 rounded bg-status-success/10 px-1 text-status-success">live ok</span>
                                )}
                              </button>
                            );
                          })}
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
                      variant="ghost"
                      disabled={isRefreshingBasketId === instance.id || !can('bots:run')}
                      onClick={() => refreshBasket(instance)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {isRefreshingBasketId === instance.id
                        ? 'Atualizando...'
                        : basket.source === 'manual'
                          ? 'Atualizar lista'
                          : 'Recalcular cesta'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!can('bots:edit')}
                      onClick={() => openBasketEditor(instance)}
                    >
                      {basket.source === 'manual' ? 'Editar ativos' : 'Selecionar ativos'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isRunningId === instance.id || !can('bots:run')}
                      onClick={() => runPaper(instance)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {isRunningId === instance.id ? 'Rodando cesta...' : 'Rodar cesta paper'}
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
      {basketEditor && (() => {
        const editorBasket = botBasketView(basketEditor.instance);
        const legSymbolsByDirection = (direction: string) => editorBasket.legs
          .filter((leg) => String(leg.direction || '') === direction)
          .flatMap((leg) => (Array.isArray(leg.symbols) ? leg.symbols.map((symbol) => normalizeBotSymbol(String(symbol))) : []))
          .filter(Boolean);
        const loserSymbols = Array.from(new Set(legSymbolsByDirection('losers')));
        const gainerSymbols = Array.from(new Set(legSymbolsByDirection('gainers')));
        const legSymbols = [...loserSymbols, ...gainerSymbols];
        const legSymbolSet = new Set(legSymbols);
        const candidateSymbols = Array.from(new Set([...editorBasket.symbols, ...legSymbols]))
          .map(normalizeBotSymbol)
          .filter(Boolean);
        const otherCandidateSymbols = candidateSymbols.filter((symbol) => !legSymbolSet.has(symbol));
        const selectedSymbols = new Set(basketEditorSymbols);
        const searchTerm = basketSearch.trim().toUpperCase();
        const universeSymbols = universeAssets
          .map((asset) => normalizeBotSymbol(asset.symbol))
          .filter(Boolean);
        const topUniverseSymbols = Array.from(new Set(universeSymbols)).slice(0, 50);
        const searchedUniverseSymbols = Array.from(new Set(
          universeSymbols.filter((symbol) => {
            if (!searchTerm) return true;
            const asset = universeBySymbol.get(symbol);
            return (
              symbol.includes(searchTerm)
              || String(asset?.base_asset || '').toUpperCase().includes(searchTerm)
              || String(asset?.display_name || '').toUpperCase().includes(searchTerm)
            );
          })
        )).slice(0, 50);
        const discoverySymbols = searchTerm ? searchedUniverseSymbols : topUniverseSymbols;
        const renderSymbolButton = (symbol: string, tone: 'default' | 'up' | 'down' = 'default') => {
          const normalized = normalizeBotSymbol(symbol);
          const selected = selectedSymbols.has(normalized);
          const toneClass = tone === 'up'
            ? 'border-status-success/35 text-status-success'
            : tone === 'down'
              ? 'border-status-error/35 text-status-error'
              : 'border-border-subtle text-text-secondary';
          return (
            <button
              key={normalized}
              type="button"
              onClick={() => toggleBasketEditorSymbol(normalized)}
              className={`rounded-lg border px-3 py-2 text-caption font-semibold transition ${
                selected
                  ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue'
                  : `bg-background-primary hover:border-accent-blue/40 hover:text-text-primary ${toneClass}`
              }`}
              title={selected ? 'Remover da cesta manual' : 'Adicionar na cesta manual'}
            >
              {normalized}
            </button>
          );
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border-subtle bg-background-primary shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
                <div>
                  <p className="text-overline uppercase tracking-[0.22em] text-accent-blue">Cesta do bot</p>
                  <h2 className="mt-1 text-heading-sm text-text-primary">Selecionar ativos monitorados</h2>
                  <p className="mt-1 text-caption text-text-muted">
                    {basketEditor.instance.name} - salvar aqui transforma esta instancia em modo manual.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBasketSearch('');
                    setBasketEditor(null);
                  }}
                  className="rounded-xl border border-border-subtle p-2 text-text-muted transition hover:border-accent-blue/40 hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 p-5 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-body-sm font-semibold text-text-primary">Origem da cesta automatica</p>
                      <p className="text-caption text-text-tertiary">
                        Separe o que veio de queda e o que veio de alta antes de travar a lista final.
                      </p>
                    </div>
                    <Badge variant="blue" size="sm">{selectedSymbols.size}/{candidateSymbols.length || selectedSymbols.size}</Badge>
                  </div>
                  {candidateSymbols.length ? (
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-xl border border-border-subtle bg-background-primary/70 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="flex items-center gap-2 text-caption font-semibold text-status-error">
                            <ArrowDownRight className="h-3.5 w-3.5" />
                            Quedas monitoradas
                          </p>
                          <Badge variant="error" size="sm">{loserSymbols.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {loserSymbols.length ? loserSymbols.map((symbol) => renderSymbolButton(symbol, 'down')) : (
                            <span className="text-caption text-text-tertiary">Sem perna de queda nesta cesta.</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-background-primary/70 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="flex items-center gap-2 text-caption font-semibold text-status-success">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            Altas monitoradas
                          </p>
                          <Badge variant="success" size="sm">{gainerSymbols.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {gainerSymbols.length ? gainerSymbols.map((symbol) => renderSymbolButton(symbol, 'up')) : (
                            <span className="text-caption text-text-tertiary">Sem perna de alta nesta cesta.</span>
                          )}
                        </div>
                      </div>
                      {otherCandidateSymbols.length > 0 && (
                        <div className="rounded-xl border border-border-subtle bg-background-primary/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-caption font-semibold text-text-primary">
                              Outros candidatos / manual atual
                            </p>
                            <Badge variant="default" size="sm">{otherCandidateSymbols.length}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {otherCandidateSymbols.map((symbol) => renderSymbolButton(symbol))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-border-subtle bg-background-primary p-4 text-caption text-text-tertiary">
                      Esta instancia ainda nao tem cesta gerada. Informe ativos manualmente ao lado.
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                  <p className="text-body-sm font-semibold text-text-primary">Buscar ativos conhecidos</p>
                  <p className="mt-1 text-caption text-text-tertiary">
                    Pesquise ou use o Top 50 por volume para adicionar ativos que nao entraram nos extremos.
                  </p>
                  <input
                    value={basketSearch}
                    onChange={(event) => setBasketSearch(event.target.value)}
                    placeholder="Buscar ativo. Ex: BTC, ETH, SOL"
                    className="mt-4 h-10 w-full rounded-xl border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                  />
                  <div className="mt-3 rounded-xl border border-border-subtle bg-background-primary/70 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-caption font-semibold text-text-primary">
                        {searchTerm ? 'Resultado da busca' : 'Top 50 por volume'}
                      </p>
                      <Badge variant="default" size="sm">{discoverySymbols.length}</Badge>
                    </div>
                    <div className="flex max-h-[150px] flex-wrap gap-2 overflow-y-auto pr-1">
                      {discoverySymbols.length ? discoverySymbols.map((symbol) => renderSymbolButton(symbol)) : (
                        <span className="text-caption text-text-tertiary">Nenhum ativo encontrado no universo carregado.</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 text-body-sm font-semibold text-text-primary">Lista final manual</p>
                  <textarea
                    value={basketEditor.value}
                    onChange={(event) => setBasketEditor({ ...basketEditor, value: event.target.value })}
                    placeholder="BTC, ETH, SOL, LINK, AVAX"
                    className="mt-4 min-h-[160px] w-full rounded-xl border border-border-subtle bg-background-primary p-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                  />
                  <div className="mt-3 grid gap-2 text-caption text-text-tertiary">
                    <p>Selecionados: <span className="font-semibold text-text-primary">{selectedSymbols.size}</span></p>
                    <p>Paper, sinais e backtest em cesta passam a usar somente esta lista.</p>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setBasketSearch('');
                        setBasketEditor(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={isSavingBasketId === basketEditor.instance.id || !can('bots:edit')}
                      onClick={saveBasketSelection}
                    >
                      {isSavingBasketId === basketEditor.instance.id ? 'Salvando...' : 'Salvar cesta manual'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {backtestSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-4">
          <div className="max-h-[94vh] w-full max-w-[min(1280px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-border-subtle bg-background-primary shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-background-primary/95 p-4 backdrop-blur sm:p-5">
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

            <div className="grid max-h-[calc(94vh-96px)] min-w-0 gap-4 overflow-y-auto p-3 sm:p-4 xl:grid-cols-[300px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-4 xl:sticky xl:top-0 xl:self-start">
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
                  <div className="p-3 sm:p-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1 text-caption text-text-secondary">
                        Timeframe
                        <Select
                          value={backtestForm.timeframe}
                          options={[
                            { value: '15m', label: '15m - rapido' },
                            { value: '30m', label: '30m - curto' },
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
                            type="number"
                            min={1}
                            max={18}
                            value={backtestForm.months}
                            onChange={(event) => updateBacktestForm({ months: event.target.value })}
                            className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 pr-16 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.14em] text-text-tertiary">meses</span>
                        </div>
                        <p className="text-[10px] text-text-tertiary">
                          Maximo 18 meses. Se o ativo for novo, usamos o historico real disponivel na exchange e avisamos o periodo.
                        </p>
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
                      <label className="space-y-1 text-caption text-text-secondary">
                        Modelo de stop
                        <Select
                          value={backtestForm.stopModel}
                          options={[
                            { value: 'alpha_trend', label: 'AlphaTrend' },
                            { value: 'atr', label: 'ATR' },
                          ]}
                          onChange={(event) => updateBacktestForm({ stopModel: event.target.value as StopModel })}
                          className="h-10 py-0"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        ATR periodo
                        <input
                          value={backtestForm.atrStopLength}
                          onChange={(event) => updateBacktestForm({ atrStopLength: event.target.value })}
                          disabled={backtestForm.stopModel !== 'atr'}
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue disabled:opacity-50"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        ATR multiplicador
                        <input
                          value={backtestForm.atrStopMultiplier}
                          onChange={(event) => updateBacktestForm({ atrStopMultiplier: event.target.value })}
                          disabled={backtestForm.stopModel !== 'atr'}
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue disabled:opacity-50"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Buffer ATR %
                        <input
                          value={backtestForm.atrStopBufferPercent}
                          onChange={(event) => updateBacktestForm({ atrStopBufferPercent: event.target.value })}
                          disabled={backtestForm.stopModel !== 'atr'}
                          placeholder="0.10"
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue disabled:opacity-50"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Stop loss %
                        <input
                          value={backtestForm.stopLossPercent}
                          onChange={(event) => updateBacktestForm({ stopLossPercent: event.target.value })}
                          placeholder="3"
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Take profit %
                        <input
                          value={backtestForm.takeProfitPercent}
                          onChange={(event) => updateBacktestForm({ takeProfitPercent: event.target.value })}
                          placeholder="8"
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Breakeven apos %
                        <input
                          value={backtestForm.breakevenPercent}
                          onChange={(event) => updateBacktestForm({ breakevenPercent: event.target.value })}
                          placeholder="4"
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </label>
                      <label className="space-y-1 text-caption text-text-secondary">
                        Trailing %
                        <input
                          value={backtestForm.trailingStopPercent}
                          onChange={(event) => updateBacktestForm({ trailingStopPercent: event.target.value })}
                          placeholder="0 desliga"
                          className="h-10 w-full rounded-lg border border-border-subtle bg-background-secondary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </label>
                      <div className="rounded-lg border border-border-subtle bg-background-secondary/70 p-3 sm:col-span-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary">Modelo</p>
                        <p className="mt-1 text-caption font-semibold text-text-primary">
                          Long-only + {backtestForm.stopModel === 'atr' ? 'ATR stop' : 'AlphaTrend stop'}
                        </p>
                        <p className="mt-1 text-[11px] text-text-tertiary">
                          Backtest usa o mesmo resolvedor de stop do paper. Short e live seguem bloqueados nesta fase.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="mt-4 w-full"
                      disabled={isBacktestSubmitting || !can('bots:backtest')}
                      onClick={runAssetBacktest}
                    >
                      <BarChart3 className="h-4 w-4" />
                          {isBacktestSubmitting ? 'Enfileirando...' : 'Executar backtest'}
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
                      <span>Etapa</span>
                      <span className="text-right font-semibold text-text-primary">
                        {backtestStageLabel(backtestRun)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Cobertura historica</span>
                      <span className="font-semibold text-text-primary">
                        {backtestRun ? `${Number(backtestRun.data_quality?.period_coverage_percent || 0).toFixed(2)}%` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Historico disponivel</span>
                      <span className="max-w-[62%] text-right font-semibold text-text-primary">
                        {backtestAvailableHistoryLabel(backtestRun)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Preload exchange</span>
                      <span className="max-w-[62%] text-right font-semibold text-text-primary">
                        {backtestPreloadLabel(backtestRun)}
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

              <div className="min-w-0 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

                <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
                  <Card variant="glass" className="min-w-0 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-body-sm font-semibold text-text-primary">Equity curve</p>
                      <Badge variant="blue" size="sm">{backtestChart?.timeframe || chartTimeframe}</Badge>
                    </div>
                    <div className="mt-4 h-32 rounded-xl border border-border-subtle bg-background-secondary/50 p-3">
                      <MiniLineChart points={backtestRun?.equity_curve} valueKey="equity" tone="blue" />
                    </div>
                  </Card>

                  <Card variant="glass" className="min-w-0 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-body-sm font-semibold text-text-primary">Drawdown</p>
                      <Badge variant="yellow" size="sm">risco</Badge>
                    </div>
                    <div className="mt-4 h-32 rounded-xl border border-border-subtle bg-background-secondary/50 p-3">
                      <MiniLineChart
                        points={backtestRun?.drawdown_curve}
                        valueKey="drawdown_percent"
                        tone="red"
                        transform={(value) => -Math.abs(value)}
                        baselineZero
                      />
                    </div>
                  </Card>
                </div>

                <Card variant="glass" className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-body-sm font-semibold text-text-primary">Candles e execucoes</p>
                      <p className="mt-1 text-caption text-text-tertiary">
                        Entradas em azul, saidas em verde/vermelho conforme P&L liquido.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="blue" size="sm">
                        {backtestChart
                          ? `${backtestChart.candle_count_returned}/${backtestChart.candle_count_full} candles`
                          : 'candles'}
                      </Badge>
                      <Badge variant="purple" size="sm">
                        {backtestChart ? `${backtestChart.trade_count_returned} trades` : 'execucoes'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent-blue/25 bg-accent-blue/10 px-2 py-1 text-accent-blue">
                      <span className="h-2 w-2 rounded-full bg-accent-blue" />
                      Entrada
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-status-success/25 bg-status-success/10 px-2 py-1 text-status-success">
                      <span className="h-2 w-2 rotate-45 bg-status-success" />
                      Saida lucro
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-status-error/25 bg-status-error/10 px-2 py-1 text-status-error">
                      <span className="h-2 w-2 rotate-45 bg-status-error" />
                      Saida prejuizo
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-background-secondary/40 p-2">
                    <div className="flex flex-wrap gap-2">
                      {['15m', '30m', '1h', '4h', '1d'].map((timeframe) => {
                        const active = chartTimeframe === timeframe;
                        return (
                          <button
                            key={timeframe}
                            type="button"
                            onClick={() => setChartTimeframe(timeframe)}
                            className={`rounded-lg border px-3 py-1.5 text-caption font-semibold transition ${
                              active
                                ? 'border-accent-blue bg-accent-blue text-white'
                                : 'border-border-subtle text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue'
                            }`}
                          >
                            {timeframe}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {([
                        { key: 'bcAlphaTrend', label: 'AlphaTrend' },
                        { key: 'atrStop', label: 'ATR Stop' },
                        { key: 'ma20', label: 'MA20' },
                        { key: 'ma50', label: 'MA50' },
                        { key: 'supportResistance', label: 'S/R' },
                      ] as const).map((indicator) => {
                        const active = chartIndicators[indicator.key];
                        return (
                          <button
                            key={indicator.key}
                            type="button"
                            onClick={() =>
                              setChartIndicators((current) => ({
                                ...current,
                                [indicator.key]: !current[indicator.key],
                              }))
                            }
                            className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                              active
                                ? 'border-accent-purple/40 bg-accent-purple/10 text-accent-purple'
                                : 'border-border-subtle text-text-tertiary hover:border-accent-purple/40 hover:text-accent-purple'
                            }`}
                          >
                            {indicator.label}
                          </button>
                        );
                      })}
                      <span className="rounded-lg border border-border-subtle px-2 py-1 text-caption text-text-tertiary">
                        Visual independente: trades preservados; indicadores e ATR Stop recalculados no timeframe visual
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl">
                    <BacktestCandleChart
                      chart={backtestChart}
                      trades={backtestTrades}
                      loading={isBacktestChartLoading}
                      error={backtestChartError}
                      indicators={chartIndicators}
                    />
                  </div>
                </Card>

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
                    <div>
                      <p className="text-body-sm font-semibold text-text-primary">Trades normalizados</p>
                      <p className="mt-1 text-caption text-text-tertiary">
                        Entrada, saida, precos executados, ROI e P&L liquido de cada operacao.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="purple" size="sm">
                        {displayedBacktestTrades.length
                          ? `${displayedBacktestTrades.length} carregados de ${metricNumber(backtestRun, 'trade_count') || displayedBacktestTrades.length}`
                          : `${metricNumber(backtestRun, 'trade_count')} trades`}
                      </Badge>
                      {isBacktestTradesLoading && <Badge variant="yellow" size="sm">carregando</Badge>}
                    </div>
                  </div>
                  {displayedBacktestTrades.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {[
                        { label: 'P&L total', value: formatCompactUsd(backtestTradeStats.totalPnl), tone: metricTone(backtestTradeStats.totalPnl) },
                        { label: 'P&L medio', value: formatCompactUsd(backtestTradeStats.avgPnl), tone: metricTone(backtestTradeStats.avgPnl) },
                        { label: 'Vencedores', value: String(backtestTradeStats.winners), tone: 'text-status-success' },
                        { label: 'Perdedores', value: String(backtestTradeStats.losers), tone: 'text-status-error' },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-border-subtle bg-background-secondary/50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary">{item.label}</p>
                          <p className={`mt-1 text-body-sm font-semibold ${item.tone}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 overflow-hidden rounded-xl border border-border-subtle">
                    <div className="overflow-x-auto">
                      <div className="min-w-[920px]">
                        <div className="grid grid-cols-[1.1fr_1.1fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr] bg-background-secondary/70 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
                          <span>Entrada</span>
                          <span>Saida</span>
                          <span>Precos</span>
                          <span>P&L</span>
                          <span>ROI</span>
                          <span>MAE/MFE</span>
                          <span>Motivo</span>
                        </div>
                        {backtestTradesError ? (
                          <div className="px-3 py-6 text-center text-caption text-status-error">
                            {backtestTradesError}
                          </div>
                        ) : displayedBacktestTrades.length ? (
                          <div className="max-h-72 overflow-y-auto">
                            {displayedBacktestTrades.map((trade) => {
                              const payload = auditRecord(trade.raw_payload);
                              const entryAudit = auditRecord(payload.entry);
                              const exitAudit = auditRecord(payload.exit);
                              const entryConditions = auditConditionLabels(entryAudit.conditions || payload.entry_conditions);
                              const exitConditions = auditConditionLabels(exitAudit.conditions || payload.exit_conditions);
                              const entryIndicators = auditIndicatorLabels(entryAudit.indicators);
                              const exitIndicators = auditIndicatorLabels(exitAudit.indicators);
                              const stopLabels = auditStopLabels(exitAudit.stop, exitAudit.levels);
                              const hasAudit =
                                entryConditions.length > 0 ||
                                exitConditions.length > 0 ||
                                entryIndicators.length > 0 ||
                                exitIndicators.length > 0 ||
                                stopLabels.length > 0;
                              return (
                                <div key={trade.id} className="border-t border-border-subtle">
                                  <div className="grid grid-cols-[1.1fr_1.1fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr] px-3 py-2 text-caption text-text-secondary">
                                    <span>{formatDateTime(trade.entry_time)}</span>
                                    <span>{trade.exit_time ? formatDateTime(trade.exit_time) : 'aberto'}</span>
                                    <span>{formatCompactUsd(trade.entry_price)} {'->'} {trade.exit_price ? formatCompactUsd(trade.exit_price) : '-'}</span>
                                    <span className={metricTone(Number(trade.net_pnl))}>{formatCompactUsd(Number(trade.net_pnl))}</span>
                                    <span className={metricTone(Number(trade.return_percent))}>{formatPercent(Number(trade.return_percent))}</span>
                                    <span>{formatPercent(Number(trade.mae_percent))} / {formatPercent(Number(trade.mfe_percent))}</span>
                                    <span>{trade.exit_reason || trade.entry_reason || '-'}</span>
                                  </div>
                                  <details className="bg-background-secondary/30 px-3 pb-3 pt-1 text-[10px] text-text-tertiary">
                                    <summary className="cursor-pointer select-none py-2 font-semibold uppercase tracking-[0.14em] text-text-secondary">
                                      Ver auditoria do trade
                                    </summary>
                                    <div className="grid gap-2 lg:grid-cols-3">
                                    <div className="rounded-lg border border-border-subtle bg-background-primary/60 p-2">
                                      <p className="mb-1 font-semibold uppercase tracking-[0.14em] text-accent-blue">Entrada</p>
                                      {entryConditions.length ? (
                                        <div className="space-y-1">
                                          {entryConditions.map((condition, index) => (
                                            <p key={`${condition.key}:${index}`} className={condition.passed ? 'text-status-success' : 'text-status-error'}>
                                              {condition.passed ? 'check' : 'block'} · {condition.label} · {condition.detail}
                                            </p>
                                          ))}
                                        </div>
                                      ) : (
                                        <p>{hasAudit ? 'Sem gates de entrada gravados.' : 'Auditoria detalhada disponível nos novos backtests.'}</p>
                                      )}
                                    </div>
                                    <div className="rounded-lg border border-border-subtle bg-background-primary/60 p-2">
                                      <p className="mb-1 font-semibold uppercase tracking-[0.14em] text-accent-purple">Indicadores</p>
                                      <div className="grid grid-cols-2 gap-1">
                                        {[...entryIndicators, ...exitIndicators].slice(0, 8).map((indicator, index) => (
                                          <span key={`${trade.id}:${indicator.key}:${indicator.label}:${index}`} className="rounded-md bg-background-secondary px-2 py-1">
                                            {indicator.label}: <strong className="text-text-primary">{indicator.value}</strong>
                                          </span>
                                        ))}
                                      </div>
                                      {!entryIndicators.length && !exitIndicators.length && (
                                        <p>{hasAudit ? 'Sem snapshot de indicadores.' : 'Reexecute o backtest para preencher os indicadores por trade.'}</p>
                                      )}
                                    </div>
                                    <div className="rounded-lg border border-border-subtle bg-background-primary/60 p-2">
                                      <p className="mb-1 font-semibold uppercase tracking-[0.14em] text-status-warning">Saida / stop</p>
                                      {stopLabels.length ? (
                                        <div className="grid grid-cols-2 gap-1">
                                          {stopLabels.map((item) => (
                                            <span key={`${trade.id}:${item.label}`} className="rounded-md bg-background-secondary px-2 py-1">
                                              {item.label}: <strong className="text-text-primary">{item.value}</strong>
                                            </span>
                                          ))}
                                        </div>
                                      ) : exitConditions.length ? (
                                        <div className="space-y-1">
                                          {exitConditions.map((condition, index) => (
                                            <p key={`${condition.key}:${index}`} className={condition.passed ? 'text-status-success' : 'text-text-tertiary'}>
                                              {condition.passed ? 'check' : 'idle'} · {condition.label} · {condition.detail}
                                            </p>
                                          ))}
                                        </div>
                                      ) : (
                                        <p>{hasAudit ? 'Sem detalhe de stop.' : 'Novo backtest vai gravar o nivel exato de saida.'}</p>
                                      )}
                                    </div>
                                    </div>
                                  </details>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-3 py-6 text-center text-caption text-text-tertiary">
                            {backtestRun?.status === 'succeeded' ? 'Nenhum trade foi gerado para esta janela.' : 'Os trades aparecem aqui quando o worker concluir.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-caption text-text-tertiary">
                    Taxas e slippage entram no preco executado e no P&L liquido. MAE/MFE ajudam a avaliar fragilidade e potencial intratrade.
                    {backtestChart && metricNumber(backtestRun, 'trade_count') > backtestChart.trade_count_returned
                      ? ` Mostrando os primeiros ${backtestChart.trade_count_returned} trades; paginacao completa entra no proximo refinamento.`
                      : ''}
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

