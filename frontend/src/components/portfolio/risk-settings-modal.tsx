'use client';

import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import {
  RiskThresholds,
  DEFAULT_RISK_THRESHOLDS,
  THRESHOLD_RANGES,
  METRIC_LABELS,
} from '@/lib/risk/risk-types';

export interface RiskSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  thresholds: RiskThresholds;
  onSave: (thresholds: RiskThresholds) => void;
  onReset: () => void;
}

export function RiskSettingsModal({
  isOpen,
  onClose,
  thresholds,
  onSave,
  onReset,
}: RiskSettingsModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Estado local para edição (só salva quando clicar "Save")
  const [draft, setDraft] = useState<RiskThresholds>(thresholds);

  // Sync draft quando o modal abre
  const handleOpen = useCallback(() => {
    setDraft(thresholds);
  }, [thresholds]);

  // Atualizar valor de threshold individual
  const updateThreshold = useCallback((
    metric: keyof RiskThresholds,
    level: 'warning' | 'danger',
    value: number
  ) => {
    setDraft(prev => ({
      ...prev,
      [metric]: {
        ...prev[metric],
        [level]: value,
      },
    }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft);
    onClose();
  }, [draft, onSave, onClose]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_RISK_THRESHOLDS);
    onReset();
  }, [onReset]);

  // Sync draft quando thresholds externos mudam
  if (isOpen && draft !== thresholds) {
    // Apenas na abertura inicial
  }

  const metricKeys = Object.keys(METRIC_LABELS) as Array<keyof RiskThresholds>;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurações de Risco"
      size="lg"
      onAnimationEnd={handleOpen}
    >
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        <p className={cn(
          'text-[11px]',
          isDark ? 'text-white/40' : 'text-gray-500'
        )}>
          Configure os thresholds de Warning e Danger para cada métrica de risco.
          Alertas serão gerados quando os valores ultrapassarem os limites definidos.
        </p>

        {metricKeys.map((metric) => {
          const range = THRESHOLD_RANGES[metric];
          const label = METRIC_LABELS[metric];
          const warningValue = draft[metric].warning;
          const dangerValue = draft[metric].danger;

          return (
            <div
              key={metric}
              className={cn(
                'rounded-lg p-3',
                isDark ? 'bg-white/[0.03] border border-white/[0.05]' : 'bg-gray-50 border border-gray-200'
              )}
            >
              {/* Metric Header */}
              <div className="mb-3">
                <h4 className={cn(
                  'text-[11px] font-semibold',
                  isDark ? 'text-white' : 'text-gray-900'
                )}>{label.name}</h4>
                <p className={cn(
                  'text-[10px] mt-0.5',
                  isDark ? 'text-white/30' : 'text-gray-500'
                )}>{label.description}</p>
              </div>

              {/* Warning Slider */}
              <div className="mb-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'text-[10px] font-medium',
                    isDark ? 'text-accent-yellow' : 'text-yellow-600'
                  )}>
                    Warning
                  </span>
                  <span className={cn(
                    'text-[10px] font-mono tabular-nums',
                    isDark ? 'text-white/70' : 'text-gray-700'
                  )}>
                    {range.inverted ? '≤' : '≥'} {warningValue}{range.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={warningValue}
                  onChange={(e) => updateThreshold(metric, 'warning', parseFloat(e.target.value))}
                  className={cn(
                    'w-full h-1.5 rounded-full appearance-none cursor-pointer',
                    isDark ? 'bg-white/10' : 'bg-gray-300',
                    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
                    '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-yellow',
                    '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md',
                  )}
                />
              </div>

              {/* Danger Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'text-[10px] font-medium',
                    isDark ? 'text-status-error' : 'text-red-600'
                  )}>
                    Danger
                  </span>
                  <span className={cn(
                    'text-[10px] font-mono tabular-nums',
                    isDark ? 'text-white/70' : 'text-gray-700'
                  )}>
                    {range.inverted ? '≤' : '≥'} {dangerValue}{range.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={dangerValue}
                  onChange={(e) => updateThreshold(metric, 'danger', parseFloat(e.target.value))}
                  className={cn(
                    'w-full h-1.5 rounded-full appearance-none cursor-pointer',
                    isDark ? 'bg-white/10' : 'bg-gray-300',
                    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
                    '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-status-error',
                    '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md',
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ModalFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className={cn(
            'mr-auto gap-1.5',
            isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="text-[11px]">Reset Defaults</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className={cn(
            isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="text-[11px]">Cancelar</span>
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          className="bg-accent-purple hover:bg-accent-purple/90 text-white"
        >
          <span className="text-[11px]">Salvar</span>
        </Button>
      </ModalFooter>
    </Modal>
  );
}
