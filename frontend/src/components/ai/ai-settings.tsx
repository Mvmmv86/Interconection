'use client';

import { useState } from 'react';
import { Settings, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAISettings } from '@/contexts/ai-settings-context';

export function AISettings() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { config, updateConfig, clearConfig, isConfigured } = useAISettings();

  const [provider, setProvider] = useState<'anthropic' | 'openai'>(
    config?.provider || 'anthropic'
  );
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError('');
    setSuccess(false);
    setIsTesting(true);

    try {
      await updateConfig(provider, apiKey);
      setSuccess(true);
      setApiKey('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao validar API key. Verifique se a chave está correta.';
      setError(message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    clearConfig();
    setApiKey('');
    setError('');
    setSuccess(false);
  };

  return (
    <div className="max-w-2xl">
      <div
        className={cn(
          'rounded-2xl p-6 border',
          isDark
            ? 'bg-white/[0.02] border-white/[0.06]'
            : 'bg-white border-gray-200'
        )}
      >
        <div className="flex items-center gap-3 mb-6">
          <Settings className={cn('w-5 h-5', isDark ? 'text-accent-purple' : 'text-accent-purple')} />
          <div>
            <h3 className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Configuração de IA
            </h3>
            <p className={cn('text-[11px] mt-0.5', isDark ? 'text-white/60' : 'text-gray-600')}>
              Configure sua API key para usar o AI Portfolio Analyst
            </p>
          </div>
        </div>

        {/* Current Configuration */}
        {isConfigured && config && (
          <div
            className={cn(
              'mb-6 p-4 rounded-xl border',
              isDark
                ? 'bg-white/[0.03] border-white/[0.06]'
                : 'bg-gray-50 border-gray-200'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-status-success" />
                  <span className={cn('text-[13px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    Configuração Ativa
                  </span>
                </div>
                <p className={cn('text-[11px]', isDark ? 'text-white/60' : 'text-gray-600')}>
                  Provider: <span className="font-medium capitalize">{config.provider}</span>
                </p>
                <p className={cn('text-[11px]', isDark ? 'text-white/60' : 'text-gray-600')}>
                  API Key: <span className="font-mono">{config.apiKey}</span>
                </p>
              </div>
              <button
                onClick={handleClear}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDark
                    ? 'hover:bg-white/[0.06] text-white/40 hover:text-status-error'
                    : 'hover:bg-gray-200 text-gray-400 hover:text-status-error'
                )}
                title="Remover configuração"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Provider Selection */}
        <div className="mb-4">
          <label className={cn('block text-[13px] font-medium mb-2', isDark ? 'text-white' : 'text-gray-900')}>
            Provider
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProvider('anthropic')}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all border',
                provider === 'anthropic'
                  ? 'bg-accent-purple text-white border-accent-purple'
                  : isDark
                  ? 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900'
              )}
            >
              Anthropic (Claude)
            </button>
            <button
              type="button"
              onClick={() => setProvider('openai')}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all border',
                provider === 'openai'
                  ? 'bg-accent-purple text-white border-accent-purple'
                  : isDark
                  ? 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900'
              )}
            >
              OpenAI (GPT-4)
            </button>
          </div>
        </div>

        {/* API Key Input */}
        <div className="mb-4">
          <label className={cn('block text-[13px] font-medium mb-2', isDark ? 'text-white' : 'text-gray-900')}>
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError('');
              setSuccess(false);
            }}
            placeholder={
              provider === 'anthropic'
                ? 'sk-ant-api03-...'
                : 'sk-...'
            }
            className={cn(
              'w-full px-4 py-2.5 rounded-xl text-[13px] border transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent-purple/50',
              isDark
                ? 'bg-white/[0.03] border-white/[0.06] text-white placeholder-white/40'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            )}
          />
          <p className={cn('text-[11px] mt-1', isDark ? 'text-white/40' : 'text-gray-500')}>
            {provider === 'anthropic'
              ? 'Obtenha sua chave em: console.anthropic.com'
              : 'Obtenha sua chave em: platform.openai.com'}
          </p>
        </div>

        {/* Status Messages */}
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

        {success && (
          <div
            className={cn(
              'mb-4 p-3 rounded-xl border flex items-start gap-2',
              isDark
                ? 'bg-status-success/10 border-status-success/20'
                : 'bg-green-50 border-green-200'
            )}
          >
            <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
            <p className="text-[12px] text-status-success">
              API key configurada com sucesso!
            </p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || isTesting}
          className={cn(
            'w-full px-4 py-2.5 rounded-xl transition-all text-[13px] font-medium',
            'flex items-center justify-center gap-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isDark
              ? 'bg-accent-purple hover:bg-accent-purple/90 text-white'
              : 'bg-accent-purple hover:bg-accent-purple/90 text-white'
          )}
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Validando API Key...</span>
            </>
          ) : (
            <span>Salvar Configuração</span>
          )}
        </button>

        {/* Info */}
        <div
          className={cn(
            'mt-6 p-4 rounded-xl border',
            isDark
              ? 'bg-white/[0.03] border-white/[0.06]'
              : 'bg-gray-50 border-gray-200'
          )}
        >
          <h4 className={cn('text-[12px] font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
            Segurança e Privacidade
          </h4>
          <ul className={cn('text-[11px] space-y-1', isDark ? 'text-white/60' : 'text-gray-600')}>
            <li>• Suas API keys são armazenadas localmente no navegador</li>
            <li>• Nunca compartilhamos suas chaves com terceiros</li>
            <li>• Os dados do seu portfólio são enviados apenas para análise</li>
            <li>• Você pode remover a configuração a qualquer momento</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
