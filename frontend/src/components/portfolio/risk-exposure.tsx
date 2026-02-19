'use client';

import dynamic from 'next/dynamic';
import { Shield, AlertTriangle, Settings, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { RiskMetrics, RiskScore, RiskThresholds } from '@/lib/risk/risk-types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface RiskExposureProps {
  metrics: RiskMetrics | null;
  riskScore: RiskScore;
  thresholds?: RiskThresholds;
  isLoading?: boolean;
  hasData?: boolean;
  hasPriceHistory?: boolean;
  onOpenSettings?: () => void;
  onGenerateReport?: () => void;
}

const statusConfig = {
  healthy: { bg: 'bg-status-success/10', text: 'text-status-success', label: 'Healthy' },
  warning: { bg: 'bg-accent-yellow/10', text: 'text-accent-yellow', label: 'Warning' },
  danger:  { bg: 'bg-status-error/10', text: 'text-status-error', label: 'Danger' },
};

const metricStatusColors = {
  safe:    { bg: 'bg-status-success', text: 'text-status-success', fill: '#22c55e' },
  warning: { bg: 'bg-accent-yellow', text: 'text-accent-yellow', fill: '#eab308' },
  danger:  { bg: 'bg-status-error', text: 'text-status-error', fill: '#ef4444' },
};

interface DisplayMetric {
  label: string;
  value: string;
  numericValue: number;
  maxValue: number;
  status: 'safe' | 'warning' | 'danger';
  description: string;
  dangerThreshold: string; // ex: "≤ 5%" ou "≥ 0.5"
}

function getMetricStatus(value: number, warning: number, danger: number, inverted = false): 'safe' | 'warning' | 'danger' {
  if (inverted) {
    if (value <= danger) return 'danger';
    if (value <= warning) return 'warning';
    return 'safe';
  }
  if (value >= danger) return 'danger';
  if (value >= warning) return 'warning';
  return 'safe';
}

export function RiskExposure({
  metrics,
  riskScore,
  thresholds,
  isLoading,
  hasData,
  hasPriceHistory,
  onOpenSettings,
  onGenerateReport,
}: RiskExposureProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const status = statusConfig[riskScore.status];

  // Thresholds (usar defaults se não passados)
  const t = thresholds || {
    var95: { warning: 3, danger: 5 },
    cvar95: { warning: 5, danger: 8 },
    maxDrawdown: { warning: 15, danger: 25 },
    leverageRatio: { warning: 2, danger: 3 },
    concentration: { warning: 25, danger: 40 },
    sharpeRatio: { warning: 1.0, danger: 0.5 },
  };

  // Montar métricas para display
  const displayMetrics: DisplayMetric[] = metrics ? [
    {
      label: 'Portfolio VaR (95%)',
      value: `${metrics.var95.toFixed(1)}%`,
      numericValue: metrics.var95,
      maxValue: 10,
      status: getMetricStatus(metrics.var95, t.var95.warning, t.var95.danger),
      description: 'Perda máxima diária (95% confiança)',
      dangerThreshold: `lim. ${t.var95.danger}%`,
    },
    {
      label: 'CVaR / Exp. Shortfall',
      value: `${metrics.cvar95.toFixed(1)}%`,
      numericValue: metrics.cvar95,
      maxValue: 15,
      status: getMetricStatus(metrics.cvar95, t.cvar95.warning, t.cvar95.danger),
      description: 'Média das perdas além do VaR',
      dangerThreshold: `lim. ${t.cvar95.danger}%`,
    },
    {
      label: 'Max Drawdown',
      value: `${metrics.maxDrawdown.toFixed(1)}%`,
      numericValue: metrics.maxDrawdown,
      maxValue: 50,
      status: getMetricStatus(metrics.maxDrawdown, t.maxDrawdown.warning, t.maxDrawdown.danger),
      description: 'Queda máxima desde o pico (30d)',
      dangerThreshold: `lim. ${t.maxDrawdown.danger}%`,
    },
    {
      label: 'Volatilidade (30d)',
      value: `${metrics.volatility30d.toFixed(1)}%`,
      numericValue: metrics.volatility30d,
      maxValue: 100,
      status: getMetricStatus(metrics.volatility30d, 40, 70),
      description: 'Volatilidade anualizada',
      dangerThreshold: 'lim. 70%',
    },
    {
      label: 'Sharpe Ratio',
      value: metrics.sharpeRatio.toFixed(2),
      numericValue: metrics.sharpeRatio,
      maxValue: 3,
      status: getMetricStatus(metrics.sharpeRatio, t.sharpeRatio.warning, t.sharpeRatio.danger, true),
      description: 'Retorno ajustado ao risco',
      dangerThreshold: `min. ${t.sharpeRatio.danger}`,
    },
    {
      label: 'Leverage Ratio',
      value: `${metrics.leverageRatio.gross.toFixed(1)}x`,
      numericValue: metrics.leverageRatio.gross,
      maxValue: 5,
      status: getMetricStatus(metrics.leverageRatio.gross, t.leverageRatio.warning, t.leverageRatio.danger),
      description: 'Exposição total / patrimônio',
      dangerThreshold: `lim. ${t.leverageRatio.danger}x`,
    },
    {
      label: 'Concentração',
      value: `${metrics.concentrationRisk.topAssetPercent.toFixed(1)}%`,
      numericValue: metrics.concentrationRisk.topAssetPercent,
      maxValue: 60,
      status: getMetricStatus(metrics.concentrationRisk.topAssetPercent, t.concentration.warning, t.concentration.danger),
      description: `Top asset: ${metrics.concentrationRisk.topAssetSymbol}`,
      dangerThreshold: `lim. ${t.concentration.danger}%`,
    },
  ] : [];

  // Montar dados de correlação para heatmap
  const correlationSeries = metrics?.correlationMatrix.assets.length
    ? metrics.correlationMatrix.assets.map((asset, i) => ({
        name: asset,
        data: metrics.correlationMatrix.matrix[i] || [],
      }))
    : [];

  const heatmapOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'heatmap',
      background: 'transparent',
      toolbar: { show: false },
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: '9px', fontFamily: 'Inter', colors: ['#fff'] },
    },
    colors: ['#3b82f6'],
    xaxis: {
      categories: metrics?.correlationMatrix.assets || [],
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.5)',
          fontSize: '9px',
          fontFamily: 'Inter',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.5)',
          fontSize: '9px',
          fontFamily: 'Inter',
        },
      },
    },
    grid: { show: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '10px', fontFamily: 'Inter' },
    },
    plotOptions: {
      heatmap: {
        radius: 4,
        colorScale: {
          ranges: [
            { from: -1, to: 0.3, color: '#22c55e', name: 'Low' },
            { from: 0.3, to: 0.6, color: '#eab308', name: 'Medium' },
            { from: 0.6, to: 1, color: '#ef4444', name: 'High' },
          ],
        },
      },
    },
  };

  // ═══════════════════════════════════════════
  // Loading State
  // ═══════════════════════════════════════════
  if (isLoading) {
    return (
      <div
        className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex items-center justify-center h-[460px]"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/20' : 'text-gray-300')} />
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-400')}>
            Calculando métricas de risco...
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // Empty State
  // ═══════════════════════════════════════════
  if (!hasData) {
    return (
      <div
        className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex flex-col items-center justify-center h-[460px]"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <Shield className={cn('w-8 h-8 mb-2', isDark ? 'text-white/10' : 'text-gray-200')} />
        <p className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
          Sem dados de risco disponíveis
        </p>
        <p className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-gray-300')}>
          Conecte uma wallet ou exchange para análise de risco
        </p>
      </div>
    );
  }

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className={cn(
        'flex items-center justify-between pb-3 mb-3 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-status-error/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-status-error" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Risk Exposure
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
              Portfolio health metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded-md', status.bg)}>
            <Shield className={cn('w-3 h-3', status.text)} />
            <span className={cn('text-[10px] font-medium', status.text)}>{status.label}</span>
          </div>
          {onGenerateReport && (
            <button
              onClick={onGenerateReport}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                isDark
                  ? 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'
                  : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
              )}
              title="Gerar relatório de análise"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                isDark
                  ? 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'
                  : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
              )}
              title="Configurar thresholds"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="space-y-2.5 mb-4">
        {displayMetrics.map((metric) => {
          const percentage = (metric.numericValue / metric.maxValue) * 100;
          const colors = metricStatusColors[metric.status];
          return (
            <div key={metric.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[10px]', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {metric.label}
                  </span>
                  {metric.status !== 'safe' && (
                    <span className="inline-flex items-center gap-0.5" title={`Limite: ${metric.dangerThreshold}`}>
                      <AlertTriangle className={cn('w-3 h-3', colors.text)} />
                      <span className={cn('text-[8px] font-medium opacity-70', colors.text)}>
                        {metric.dangerThreshold}
                      </span>
                    </span>
                  )}
                </div>
                <span className={cn('text-[11px] font-medium tabular-nums', colors.text)}>
                  {metric.value}
                </span>
              </div>
              <div className={cn(
                'h-1.5 rounded-full overflow-hidden',
                isDark ? 'bg-white/[0.05]' : 'bg-gray-200'
              )}>
                <div
                  className={cn('h-full rounded-full transition-all', colors.bg)}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <p className={cn('text-[9px] mt-0.5', isDark ? 'text-white/30' : 'text-gray-500')}>
                {metric.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Correlation Heatmap */}
      {correlationSeries.length > 1 && (
        <div className={cn(
          'pt-3.5 border-t',
          isDark ? 'border-white/[0.03]' : 'border-gray-100'
        )}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={cn(
              'text-[10px] font-medium uppercase tracking-wider',
              isDark ? 'text-white/70' : 'text-gray-700'
            )}>
              Asset Correlation
            </span>
            <span className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>30 days</span>
          </div>
          <div className="h-[165px]">
            <Chart options={heatmapOptions} series={correlationSeries} type="heatmap" height="100%" />
          </div>
        </div>
      )}

      {/* Não tem histórico de preço - aviso */}
      {hasData && !hasPriceHistory && (
        <div className={cn(
          'mt-3 pt-3 border-t',
          isDark ? 'border-white/[0.03]' : 'border-gray-100'
        )}>
          <div className={cn(
            'flex items-start gap-2 p-2 rounded-lg',
            isDark ? 'bg-accent-blue/5 border border-accent-blue/10' : 'bg-blue-50 border border-blue-100'
          )}>
            <Shield className="w-4 h-4 text-accent-blue shrink-0 mt-0.5" />
            <div>
              <p className={cn('text-[10px] font-medium', isDark ? 'text-accent-blue' : 'text-blue-600')}>
                Carregando histórico
              </p>
              <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                VaR, CVaR, Sharpe e correlação requerem dados históricos de 30 dias
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Alerts */}
      {riskScore.alerts.length > 0 && (
        <div className={cn(
          'mt-3 pt-3 border-t space-y-2',
          isDark ? 'border-white/[0.03]' : 'border-gray-100'
        )}>
          {riskScore.alerts.slice(0, 3).map((alert) => {
            const alertColor = alert.severity === 'danger' ? 'status-error' : 'accent-yellow';
            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-lg',
                  `bg-${alertColor}/5 border border-${alertColor}/10`
                )}
              >
                <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', `text-${alertColor}`)} />
                <div>
                  <p className={cn('text-[10px] font-medium', `text-${alertColor}`)}>
                    {alert.metric}
                  </p>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                    {alert.message}
                  </p>
                </div>
              </div>
            );
          })}
          {riskScore.alerts.length > 3 && (
            <p className={cn('text-[9px] text-center', isDark ? 'text-white/20' : 'text-gray-400')}>
              +{riskScore.alerts.length - 3} alerta{riskScore.alerts.length - 3 > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
