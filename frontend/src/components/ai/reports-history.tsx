'use client';

import { useState } from 'react';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAISettings } from '@/contexts/ai-settings-context';
import { useAllPositions } from '@/hooks/useAllPositions';
import { usePortfolioRisk } from '@/hooks/usePortfolioRisk';

export function ReportsHistory() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isConfigured } = useAISettings();
  const { positions, summary, distributionByType, distributionByChain } = useAllPositions();
  const { metrics, riskScore } = usePortfolioRisk(positions, summary);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateReport = async () => {
    setError('');
    setIsGenerating(true);

    try {
      const context = {
        summary,
        topPositions: positions.slice(0, 10),
        riskMetrics: metrics,
        riskScore,
        distributionByType,
        distributionByChain,
      };

      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar relatório');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report generation error:', err);
      const message = err instanceof Error ? err.message : 'Erro ao gerar relatório. Tente novamente.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isConfigured) {
    return (
      <div
        className={cn(
          'rounded-2xl p-8 text-center border',
          isDark
            ? 'bg-white/[0.02] border-white/[0.06]'
            : 'bg-gray-50 border-gray-200'
        )}
      >
        <FileText className={cn('w-12 h-12 mx-auto mb-4', isDark ? 'text-white/20' : 'text-gray-300')} />
        <h3 className={cn('text-base font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
          Configure sua API Key
        </h3>
        <p className={cn('text-[13px]', isDark ? 'text-white/60' : 'text-gray-600')}>
          Vá para a aba &ldquo;Configurações&rdquo; para adicionar sua chave da Anthropic ou OpenAI.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Generate Report Card */}
      <div
        className={cn(
          'rounded-2xl p-6 border',
          isDark
            ? 'bg-white/[0.02] border-white/[0.06]'
            : 'bg-white border-gray-200'
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
              isDark ? 'bg-accent-purple/20' : 'bg-accent-purple/10'
            )}
          >
            <FileText className="w-6 h-6 text-accent-purple" />
          </div>
          <div className="flex-1">
            <h3 className={cn('text-base font-semibold mb-1', isDark ? 'text-white' : 'text-gray-900')}>
              Relatório de Análise de Portfólio
            </h3>
            <p className={cn('text-[13px] mb-4', isDark ? 'text-white/60' : 'text-gray-600')}>
              Gere um relatório profissional completo com análise de risco, distribuição de ativos,
              performance e recomendações estratégicas baseadas em IA.
            </p>

            {/* Stats Preview */}
            <div
              className={cn(
                'grid grid-cols-3 gap-3 mb-4 p-3 rounded-xl border',
                isDark
                  ? 'bg-white/[0.03] border-white/[0.06]'
                  : 'bg-gray-50 border-gray-200'
              )}
            >
              <div>
                <p className={cn('text-[11px]', isDark ? 'text-white/40' : 'text-gray-500')}>
                  Total AUM
                </p>
                <p className={cn('text-[15px] font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  ${summary.totalValue.toLocaleString()}
                </p>
              </div>
              <div>
                <p className={cn('text-[11px]', isDark ? 'text-white/40' : 'text-gray-500')}>
                  Posições
                </p>
                <p className={cn('text-[15px] font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  {summary.totalPositionCount}
                </p>
              </div>
              <div>
                <p className={cn('text-[11px]', isDark ? 'text-white/40' : 'text-gray-500')}>
                  Risk Score
                </p>
                <p className={cn('text-[15px] font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  {riskScore?.score || 'N/A'}
                </p>
              </div>
            </div>

            {error && (
              <div
                className={cn(
                  'mb-4 p-3 rounded-xl border flex items-start gap-2',
                  isDark
                    ? 'bg-status-error/10 border-status-error/20'
                    : 'bg-red-50 border-red-200'
                )}
              >
                <AlertCircle className="w-4 h-4 text-status-error shrink-0 mt-0.5" />
                <p className="text-[12px] text-status-error">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl transition-all text-[13px] font-medium',
                'flex items-center justify-center gap-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isDark
                  ? 'bg-accent-purple hover:bg-accent-purple/90 text-white'
                  : 'bg-accent-purple hover:bg-accent-purple/90 text-white'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Relatório...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Gerar Relatório PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div
        className={cn(
          'mt-4 rounded-2xl p-6 border',
          isDark
            ? 'bg-white/[0.02] border-white/[0.06]'
            : 'bg-gray-50 border-gray-200'
        )}
      >
        <h4 className={cn('text-[13px] font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
          O relatório inclui:
        </h4>
        <ul className={cn('space-y-2 text-[12px]', isDark ? 'text-white/60' : 'text-gray-600')}>
          <li className="flex items-start gap-2">
            <span className="text-accent-purple mt-0.5">•</span>
            <span><strong>Resumo Executivo:</strong> Visão geral do portfólio e principais métricas</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-purple mt-0.5">•</span>
            <span><strong>Análise de Risco:</strong> VaR, CVaR, Sharpe Ratio, Max Drawdown e concentração</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-purple mt-0.5">•</span>
            <span><strong>Distribuição de Ativos:</strong> Exposição por asset, chain e protocolo</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-purple mt-0.5">•</span>
            <span><strong>Performance:</strong> P&L breakdown e análise de rendimentos</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-purple mt-0.5">•</span>
            <span><strong>Exposição DeFi:</strong> Análise de protocolos, pools e estratégias</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-purple mt-0.5">•</span>
            <span><strong>Recomendações:</strong> 3-5 ações estratégicas práticas e acionáveis</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
