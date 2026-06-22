'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Pause, Play, Settings2 } from 'lucide-react';
import { api, type BotInstance, type BotTemplate } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Ativo',
    configured: 'Configurado',
    paused: 'Pausado',
    error: 'Erro',
    disabled: 'Desativado',
  };
  return labels[status] || status;
}

function statusTone(status: string) {
  if (status === 'active') return 'text-status-success';
  if (status === 'error' || status === 'disabled') return 'text-status-error';
  return 'text-accent-blue';
}

export function ActiveStrategies() {
  const { isDark, label } = useThemedText();
  const { can } = useAuth();
  const [instances, setInstances] = useState<BotInstance[]>([]);
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    setIsLoading(true);
    const [instancesResult, templatesResult] = await Promise.all([
      api.getBotInstances(),
      api.getBotTemplates(),
    ]);
    if (instancesResult.success) {
      setInstances(instancesResult.data || []);
    }
    if (templatesResult.success) {
      setTemplates(templatesResult.data || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  const updateStatus = async (instance: BotInstance, status: 'active' | 'paused') => {
    setError(null);
    setIsUpdatingId(instance.id);
    const result = await api.updateBotInstance(instance.id, { status });
    setIsUpdatingId(null);
    if (result.success) {
      await loadBots();
      return;
    }
    setError(result.error || 'Nao foi possivel atualizar o bot. Verifique plano, permissao e configuracao.');
    await loadBots();
  };

  return (
    <ThemedCard>
      <div className="relative z-10 mb-3 flex items-center justify-between">
        <span className={cn('text-[11px] font-semibold uppercase tracking-wider', label)}>
          Ativacao dos bots
        </span>
        <a href="/bots" className="text-[10px] font-medium text-accent-blue hover:underline">
          Ver todos
        </a>
      </div>

      <div className="space-y-2">
        {error && (
          <div
            className="rounded-lg border px-3 py-2 text-[10px] font-medium"
            style={{
              background: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)',
              borderColor: isDark ? 'rgba(239,68,68,0.30)' : 'rgba(239,68,68,0.20)',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {isLoading && (
          <div className={cn('rounded-lg p-3 text-[11px]', isDark ? 'text-white/50' : 'text-slate-500')}>
            Carregando bots...
          </div>
        )}

        {!isLoading && instances.length === 0 && templates.slice(0, 3).map((template) => (
          <a
            key={template.id}
            href="/bots"
            className="block rounded-lg p-3 transition-all duration-200"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                : '#f8fafc',
              border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-accent-blue"
                style={{
                  background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                }}
              >
                <Settings2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[11px] font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  {template.name}
                </p>
                <p className={cn('truncate text-[10px]', isDark ? 'text-white/40' : 'text-slate-500')}>
                  Configurar na aba Bots
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-md bg-accent-blue/10 px-2 py-1 text-[10px] font-semibold text-accent-blue">
                  Setup
                </span>
                <span className={cn('text-[9px] font-semibold uppercase', isDark ? 'text-white/35' : 'text-slate-500')}>
                  {template.required_plan}
                </span>
              </div>
            </div>
          </a>
        ))}

        {!isLoading && instances.length === 0 && templates.length === 0 && (
          <div
            className="rounded-lg p-4 text-center"
            style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
              border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
            }}
          >
            <Bot className={cn('mx-auto mb-2 h-5 w-5', isDark ? 'text-white/30' : 'text-slate-400')} />
            <p className={cn('text-[11px]', isDark ? 'text-white/50' : 'text-slate-500')}>
              Nenhum bot publicado ainda.
            </p>
          </div>
        )}

        {instances.slice(0, 4).map((instance) => {
          const isActive = instance.status === 'active';
          const isUpdating = isUpdatingId === instance.id;

          return (
            <div
              key={instance.id}
              className="rounded-lg p-3 transition-all duration-200"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                  : '#f8fafc',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #e2e8f0',
              }}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isUpdating || !can('bots:edit')}
                  onClick={() => updateStatus(instance, isActive ? 'paused' : 'active')}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-50',
                    isActive ? 'text-status-success' : isDark ? 'text-white/50' : 'text-slate-500'
                  )}
                  style={{
                    background: isActive
                      ? isDark
                        ? 'rgba(34,197,94,0.15)'
                        : 'rgba(34,197,94,0.10)'
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(100,116,139,0.08)',
                  }}
                  aria-label={isActive ? 'Pausar bot' : 'Ativar bot'}
                >
                  {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-[11px] font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                    {instance.name}
                  </p>
                  <p className={cn('truncate text-[10px]', isDark ? 'text-white/40' : 'text-slate-500')}>
                    {instance.strategy_name || instance.template_name || 'Bot operacional'} - {instance.client_name}
                  </p>
                </div>

                <div className="text-right">
                  <p className={cn('text-[10px] font-semibold', statusTone(instance.status))}>
                    {statusLabel(instance.status)}
                  </p>
                  <p className={cn('text-[9px]', isDark ? 'text-white/35' : 'text-slate-500')}>
                    {instance.mode}
                  </p>
                </div>
              </div>

              <div className="mt-3 h-[4px] overflow-hidden rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: isActive ? '100%' : instance.status === 'paused' ? '45%' : '20%',
                    background: isActive
                      ? 'linear-gradient(90deg, #22c55e 0%, #06b6d4 100%)'
                      : 'linear-gradient(90deg, #94a3b8 0%, #64748b 100%)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ThemedCard>
  );
}
