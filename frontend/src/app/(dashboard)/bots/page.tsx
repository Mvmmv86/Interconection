'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Pause, Play, RefreshCw, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import {
  api,
  type BotInstance,
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
};

const defaultTemplateConfig: TemplateConfig = {
  clientId: '',
  exchangeId: '',
  strategyId: '',
  maxOrderUsd: '100',
  maxPositionUsd: '1000',
  maxDailySignals: '20',
  allowedSymbols: '',
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

export default function BotsPage() {
  const { can } = useAuth();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [strategies, setStrategies] = useState<BotStrategy[]>([]);
  const [instances, setInstances] = useState<BotInstance[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [configByTemplate, setConfigByTemplate] = useState<Record<string, TemplateConfig>>({});
  const [exchangesByClient, setExchangesByClient] = useState<Record<string, ClientPortfolioData['exchanges']>>({});
  const [signalsByInstance, setSignalsByInstance] = useState<Record<string, BotSignal[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningId, setIsRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadBots();
  }, [loadBots]);

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
        allowed_symbols: splitCsv(config.allowedSymbols).map((item) => item.toUpperCase()),
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
                          disabled={!can('bots:activate') || !config.clientId || (requiresExchange && !config.exchangeId)}
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
                        placeholder="Simbolos permitidos separados por virgula. Ex: BTC, ETH, SOL"
                        className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                      {config.clientId && supportedExchangeKeys.length > 0 && compatibleExchanges.length === 0 && (
                        <p className="text-caption text-status-warning">
                          Esta carteira ainda nao tem conexao ativa {supportedExchangeLabel}. Conecte uma exchange compativel em Positions &gt; Exchanges antes de vincular o bot.
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
              {instances.map((instance) => (
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
                  <div className="mt-3 grid gap-2 rounded-lg border border-border-subtle bg-background-primary/60 p-3 text-caption text-text-secondary">
                    <p>Max ordem: ${String(instance.risk_config.max_order_usd || 0)}</p>
                    <p>Max posicao: ${String(instance.risk_config.max_position_usd || 0)}</p>
                    <p>Simbolos: {Array.isArray(instance.risk_config.allowed_symbols) && instance.risk_config.allowed_symbols.length ? instance.risk_config.allowed_symbols.join(', ') : 'sem restricao'}</p>
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
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
