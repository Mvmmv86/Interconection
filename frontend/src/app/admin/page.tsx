'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Bot,
  Building2,
  CreditCard,
  FileText,
  Info,
  Layers3,
  LineChart,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import {
  api,
  type AdminAuditLog,
  type AdminBillingInvoice,
  type AdminBillingPayment,
  type AdminBillingSubscription,
  type AdminClient,
  type AdminFinanceSummary,
  type AdminOrganization,
  type AdminOverview,
  type AdminPlanDefinition,
  type AdminPlanUsage,
  type AdminUser,
  type BotInstance,
  type BotBacktest,
  type BotIndicator,
  type BotStrategy,
  type BotTemplate,
} from '@/lib/api/client';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type AdminTab =
  | 'overview'
  | 'accounts'
  | 'users'
  | 'clients'
  | 'strategies'
  | 'bots'
  | 'finance'
  | 'plans'
  | 'audit'
  | 'system';

const tabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Dashboard', icon: Activity },
  { id: 'accounts', label: 'Clientes', icon: Building2 },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'clients', label: 'Carteiras', icon: Layers3 },
  { id: 'strategies', label: 'Estrategias', icon: LineChart },
  { id: 'bots', label: 'Bots', icon: Bot },
  { id: 'finance', label: 'Financeiro', icon: CreditCard },
  { id: 'plans', label: 'Planos', icon: Sparkles },
  { id: 'audit', label: 'Auditoria', icon: FileText },
  { id: 'system', label: 'Sistema', icon: Shield },
];

const emptyOverview: AdminOverview = {
  organization_count: 0,
  active_organization_count: 0,
  user_count: 0,
  active_user_count: 0,
  client_count: 0,
  audit_event_count: 0,
  bot_count: 0,
  strategy_count: 0,
  plan_count: 3,
};

const emptyFinanceSummary: AdminFinanceSummary = {
  subscription_count: 0,
  active_subscription_count: 0,
  past_due_subscription_count: 0,
  open_invoice_count: 0,
  overdue_invoice_count: 0,
  mrr_cents: 0,
  open_amount_cents: 0,
  overdue_amount_cents: 0,
  paid_amount_30d_cents: 0,
  currency: 'BRL',
};

const planMetricLabels: Record<string, string> = {
  members: 'Membros',
  teams: 'Equipes',
  portfolios: 'Carteiras',
  wallets: 'Wallets',
  exchanges: 'Exchanges',
  bots: 'Bots',
  strategies: 'Estrategias',
};

const indicatorCategoryLabels: Record<string, string> = {
  moving_average: 'Medias moveis',
  momentum: 'Momentum',
  trend: 'Tendencia',
  volatility: 'Volatilidade',
  volume: 'Volume',
  crypto_derivatives: 'Cripto derivativos',
  onchain: 'On-chain',
  macro_crypto: 'Macro cripto',
};

const strategyOperatorOptions = [
  { value: 'greater_than', label: 'maior que' },
  { value: 'less_than', label: 'menor que' },
  { value: 'crosses_above', label: 'cruza acima' },
  { value: 'crosses_below', label: 'cruza abaixo' },
  { value: 'between', label: 'entre faixa' },
];

function InfoLabel({ label, info }: { label: string; info: string }) {
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-caption font-medium text-text-secondary">
      {label}
      <span className="group relative inline-flex">
        <Info className="h-3.5 w-3.5 cursor-help text-text-muted" />
        <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-64 -translate-x-1/2 rounded-lg border border-border-subtle bg-background-primary p-3 text-caption font-normal text-text-secondary shadow-lg group-hover:block">
          {info}
        </span>
      </span>
    </label>
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function getIndicatorOutputs(indicator?: BotIndicator): string[] {
  return asStringArray(indicator?.output_schema?.outputs).length > 0
    ? asStringArray(indicator?.output_schema?.outputs)
    : ['value'];
}

function getDefaultIndicatorParameters(indicator: BotIndicator): Record<string, unknown> {
  return Object.entries(indicator.parameter_schema || {}).reduce<Record<string, unknown>>((acc, [key, schema]) => {
    if (schema && typeof schema === 'object' && 'default' in schema) {
      acc[key] = (schema as { default?: unknown }).default;
    }
    return acc;
  }, {});
}

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <Card variant="glass" className="border-accent-blue/10">
      <CardContent className="py-12 text-center">
        <Sparkles className="mx-auto mb-4 h-10 w-10 text-text-muted" />
        <h2 className="text-heading-md text-text-primary">{title}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-body-sm text-text-secondary">{description}</p>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleString('pt-BR');
}

function formatLimit(value: number | null | undefined) {
  return value === null || value === undefined ? 'Ilimitado' : String(value);
}

function formatMoney(cents: number | null | undefined, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format((cents || 0) / 100);
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [planDefinitions, setPlanDefinitions] = useState<AdminPlanDefinition[]>([]);
  const [planUsages, setPlanUsages] = useState<AdminPlanUsage[]>([]);
  const [financeSummary, setFinanceSummary] = useState<AdminFinanceSummary>(emptyFinanceSummary);
  const [billingSubscriptions, setBillingSubscriptions] = useState<AdminBillingSubscription[]>([]);
  const [billingInvoices, setBillingInvoices] = useState<AdminBillingInvoice[]>([]);
  const [billingPayments, setBillingPayments] = useState<AdminBillingPayment[]>([]);
  const [botStrategies, setBotStrategies] = useState<BotStrategy[]>([]);
  const [botIndicators, setBotIndicators] = useState<BotIndicator[]>([]);
  const [botBacktests, setBotBacktests] = useState<BotBacktest[]>([]);
  const [botTemplates, setBotTemplates] = useState<BotTemplate[]>([]);
  const [botInstances, setBotInstances] = useState<BotInstance[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({ organizationId: '', amount: '', dueDate: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ invoiceId: '', amount: '', notes: '' });
  const [botTemplateForm, setBotTemplateForm] = useState({
    name: '',
    slug: '',
    type: 'dca',
    status: 'draft',
    requiredPlan: 'pro',
    description: '',
    supportedExchanges: '',
    supportedAssets: '',
    riskNotes: '',
    strategyId: '',
  });
  const [botStrategyForm, setBotStrategyForm] = useState({
    name: '',
    slug: '',
    type: 'dca',
    status: 'draft',
    description: '',
    marketType: 'spot',
    timeframes: '1h, 4h, 1d',
    exchanges: 'binance, bybit',
    selectedIndicators: [] as string[],
    indicatorParameters: {} as Record<string, Record<string, string>>,
    entryIndicator: '',
    entryOutput: 'value',
    entryOperator: 'greater_than',
    entryRightMode: 'value',
    entryCompareIndicator: '',
    entryCompareOutput: 'value',
    entryValue: '0',
    exitIndicator: '',
    exitOutput: 'value',
    exitOperator: 'less_than',
    exitRightMode: 'value',
    exitCompareIndicator: '',
    exitCompareOutput: 'value',
    exitValue: '0',
    maxOrderUsd: '100',
    maxPositionUsd: '1000',
    stopLossPercent: '3',
    takeProfitPercent: '8',
    trailingStopPercent: '2',
    breakevenPercent: '4',
    cooldownMinutes: '60',
    maxDailySignals: '5',
    allowedSymbols: '',
  });
  const [backtestForm, setBacktestForm] = useState({
    strategyId: '',
    symbol: 'BTC',
    initialCapital: '10000',
  });
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [indicatorCategoryFilter, setIndicatorCategoryFilter] = useState('all');
  const [isStrategyBuilderOpen, setIsStrategyBuilderOpen] = useState(false);
  const [strategyBuilderTab, setStrategyBuilderTab] = useState('basic');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organizationOptions = useMemo(
    () => [
      { value: '', label: 'Todos os clientes' },
      ...organizations.map((organization) => ({
        value: organization.id,
        label: organization.name,
      })),
    ],
    [organizations]
  );

  const indicatorsByCategory = useMemo(() => {
    return botIndicators.reduce<Record<string, BotIndicator[]>>((acc, indicator) => {
      acc[indicator.category] = [...(acc[indicator.category] || []), indicator];
      return acc;
    }, {});
  }, [botIndicators]);

  const indicatorCategories = useMemo(
    () => Object.keys(indicatorsByCategory).sort((a, b) => a.localeCompare(b)),
    [indicatorsByCategory]
  );

  const filteredIndicators = useMemo(() => {
    const query = indicatorSearch.trim().toLowerCase();
    return botIndicators.filter((indicator) => {
      const matchesCategory = indicatorCategoryFilter === 'all' || indicator.category === indicatorCategoryFilter;
      const matchesQuery = !query
        || indicator.name.toLowerCase().includes(query)
        || indicator.key.toLowerCase().includes(query)
        || (indicator.description || '').toLowerCase().includes(query)
        || (indicatorCategoryLabels[indicator.category] || indicator.category).toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [botIndicators, indicatorCategoryFilter, indicatorSearch]);

  const selectedStrategyIndicators = useMemo(
    () => botIndicators.filter((indicator) => botStrategyForm.selectedIndicators.includes(indicator.key)),
    [botIndicators, botStrategyForm.selectedIndicators]
  );

  const selectedIndicatorOptions = useMemo(
    () => selectedStrategyIndicators.map((indicator) => ({ value: indicator.key, label: indicator.name })),
    [selectedStrategyIndicators]
  );

  const entryIndicator = botIndicators.find((indicator) => indicator.key === botStrategyForm.entryIndicator);
  const exitIndicator = botIndicators.find((indicator) => indicator.key === botStrategyForm.exitIndicator);

  const loadAdminData = useCallback(async (organizationId?: string) => {
    if (!user?.is_superuser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const [
      overviewResult,
      orgsResult,
      usersResult,
      clientsResult,
      auditResult,
      plansResult,
      planUsageResult,
      financeSummaryResult,
      billingSubscriptionsResult,
      billingInvoicesResult,
      billingPaymentsResult,
      botStrategiesResult,
      botIndicatorsResult,
      botBacktestsResult,
      botTemplatesResult,
      botInstancesResult,
    ] = await Promise.all([
      api.getAdminOverview(),
      api.getAdminOrganizations(),
      api.getAdminUsers(organizationId),
      api.getAdminClients(organizationId),
      api.getAdminAuditLogs(organizationId),
      api.getAdminPlans(),
      api.getAdminPlanUsage(organizationId),
      api.getAdminFinanceSummary(organizationId),
      api.getAdminBillingSubscriptions(organizationId),
      api.getAdminBillingInvoices(organizationId),
      api.getAdminBillingPayments(organizationId),
      api.getAdminBotStrategies(),
      api.getAdminBotIndicators(),
      api.getAdminBotBacktests(),
      api.getAdminBotTemplates(),
      api.getAdminBotInstances(organizationId),
    ]);

    if (
      !overviewResult.success
      || !orgsResult.success
      || !usersResult.success
      || !clientsResult.success
      || !auditResult.success
      || !plansResult.success
      || !planUsageResult.success
      || !financeSummaryResult.success
      || !billingSubscriptionsResult.success
      || !billingInvoicesResult.success
      || !billingPaymentsResult.success
      || !botStrategiesResult.success
      || !botIndicatorsResult.success
      || !botBacktestsResult.success
      || !botTemplatesResult.success
      || !botInstancesResult.success
    ) {
      setError(
        overviewResult.error
        || orgsResult.error
        || usersResult.error
        || clientsResult.error
        || auditResult.error
        || plansResult.error
        || planUsageResult.error
        || financeSummaryResult.error
        || billingSubscriptionsResult.error
        || billingInvoicesResult.error
        || billingPaymentsResult.error
        || botStrategiesResult.error
        || botIndicatorsResult.error
        || botBacktestsResult.error
        || botTemplatesResult.error
        || botInstancesResult.error
        || 'Nao foi possivel carregar o admin'
      );
      setIsLoading(false);
      return;
    }

    setOverview(overviewResult.data || emptyOverview);
    setOrganizations(orgsResult.data || []);
    setUsers(usersResult.data || []);
    setClients(clientsResult.data || []);
    setAuditLogs(auditResult.data || []);
    setPlanDefinitions(plansResult.data || []);
    setPlanUsages(planUsageResult.data || []);
    setFinanceSummary(financeSummaryResult.data || emptyFinanceSummary);
    setBillingSubscriptions(billingSubscriptionsResult.data || []);
    setBillingInvoices(billingInvoicesResult.data || []);
    setBillingPayments(billingPaymentsResult.data || []);
    setBotStrategies(botStrategiesResult.data || []);
    setBotIndicators(botIndicatorsResult.data || []);
    setBotBacktests(botBacktestsResult.data || []);
    setBotTemplates(botTemplatesResult.data || []);
    setBotInstances(botInstancesResult.data || []);
    setIsLoading(false);
  }, [user?.is_superuser]);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    loadAdminData(selectedOrganizationId || undefined);
  }, [loadAdminData, selectedOrganizationId]);

  const updateOrganization = async (
    organization: AdminOrganization,
    data: { is_active?: boolean; plan?: AdminOrganization['plan'] }
  ) => {
    const result = await api.updateAdminOrganization(organization.id, data);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel atualizar a organizacao');
      return;
    }
    setOrganizations((current) => current.map((item) => item.id === organization.id ? result.data! : item));
  };

  const updateUser = async (
    targetUser: AdminUser,
    data: { is_active?: boolean; is_superuser?: boolean }
  ) => {
    const result = await api.updateAdminUser(targetUser.id, data);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel atualizar o usuario');
      return;
    }
    setUsers((current) => current.map((item) => item.id === targetUser.id ? result.data! : item));
  };

  const reloadCurrentAdminData = async () => {
    await loadAdminData(selectedOrganizationId || undefined);
  };

  const amountToCents = (value: string) => {
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return Math.round(amount * 100);
  };

  const splitCsv = (value: string) => value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const slugify = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const updateBillingSubscription = async (
    subscription: AdminBillingSubscription,
    data: Partial<{
      plan: 'free' | 'pro' | 'enterprise';
      status: string;
      billing_email: string | null;
      monthly_amount_cents: number;
      cancel_at_period_end: boolean;
    }>
  ) => {
    const result = await api.updateAdminBillingSubscription(subscription.organization_id, data);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel atualizar a assinatura');
      return;
    }
    await reloadCurrentAdminData();
  };

  const createBotStrategy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = botStrategyForm.name.trim();
    const slug = slugify(botStrategyForm.slug || name);
    if (!name || !slug) {
      setError('Informe nome e slug validos para criar a estrategia');
      return;
    }
    if (selectedStrategyIndicators.length === 0) {
      setError('Selecione ao menos um indicador para a estrategia');
      return;
    }
    const entryIndicatorConfig = entryIndicator || selectedStrategyIndicators[0];
    const exitIndicatorConfig = exitIndicator || entryIndicatorConfig;
    const entryCompareIndicatorConfig = botIndicators.find((indicator) => indicator.key === botStrategyForm.entryCompareIndicator);
    const exitCompareIndicatorConfig = botIndicators.find((indicator) => indicator.key === botStrategyForm.exitCompareIndicator);
    if (!entryIndicatorConfig || !exitIndicatorConfig) {
      setError('Configure indicadores validos para entrada e saida');
      return;
    }
    if (botStrategyForm.entryRightMode === 'indicator' && !entryCompareIndicatorConfig) {
      setError('Configure o indicador de comparacao da entrada');
      return;
    }
    if (botStrategyForm.exitRightMode === 'indicator' && !exitCompareIndicatorConfig) {
      setError('Configure o indicador de comparacao da saida');
      return;
    }
    const resolveIndicatorParameters = (indicator: BotIndicator) => {
      const defaults = getDefaultIndicatorParameters(indicator);
      const overrides = botStrategyForm.indicatorParameters[indicator.key] || {};
      return Object.entries({ ...defaults, ...overrides }).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (typeof value === 'string') {
          const parsed = Number.parseFloat(value.replace(',', '.'));
          acc[key] = Number.isFinite(parsed) && value.trim() !== '' ? parsed : value;
          return acc;
        }
        acc[key] = value;
        return acc;
      }, {});
    };
    const result = await api.createAdminBotStrategy({
      name,
      slug,
      type: botStrategyForm.type,
      status: botStrategyForm.status,
      description: botStrategyForm.description || null,
      market_config: {
        market_type: botStrategyForm.marketType,
        allowed_symbols: splitCsv(botStrategyForm.allowedSymbols).map((asset) => asset.toUpperCase()),
        supported_timeframes: splitCsv(botStrategyForm.timeframes),
        supported_exchanges: splitCsv(botStrategyForm.exchanges).map((exchange) => exchange.toLowerCase()),
      },
      indicator_config: {
        version: 1,
        indicators: selectedStrategyIndicators.map((indicator) => ({
          key: indicator.key,
          name: indicator.name,
          category: indicator.category,
          parameters: resolveIndicatorParameters(indicator),
          outputs: getIndicatorOutputs(indicator),
        })),
      },
      rule_config: {
        version: 1,
        logic: 'AND',
        entry: {
          action: 'buy',
          conditions: [
            {
              indicator: entryIndicatorConfig.key,
              output: botStrategyForm.entryOutput || getIndicatorOutputs(entryIndicatorConfig)[0],
              operator: botStrategyForm.entryOperator,
              right_type: botStrategyForm.entryRightMode,
              value: botStrategyForm.entryRightMode === 'value' ? parseNumber(botStrategyForm.entryValue, 0) : null,
              compare_to: botStrategyForm.entryRightMode === 'indicator' && entryCompareIndicatorConfig
                ? {
                  indicator: entryCompareIndicatorConfig.key,
                  output: botStrategyForm.entryCompareOutput || getIndicatorOutputs(entryCompareIndicatorConfig)[0],
                }
                : null,
            },
          ],
        },
        exit: {
          action: 'sell',
          conditions: [
            {
              indicator: exitIndicatorConfig.key,
              output: botStrategyForm.exitOutput || getIndicatorOutputs(exitIndicatorConfig)[0],
              operator: botStrategyForm.exitOperator,
              right_type: botStrategyForm.exitRightMode,
              value: botStrategyForm.exitRightMode === 'value' ? parseNumber(botStrategyForm.exitValue, 0) : null,
              compare_to: botStrategyForm.exitRightMode === 'indicator' && exitCompareIndicatorConfig
                ? {
                  indicator: exitCompareIndicatorConfig.key,
                  output: botStrategyForm.exitCompareOutput || getIndicatorOutputs(exitCompareIndicatorConfig)[0],
                }
                : null,
            },
          ],
        },
      },
      risk_defaults: {
        max_order_usd: parseNumber(botStrategyForm.maxOrderUsd, 100),
        max_position_usd: parseNumber(botStrategyForm.maxPositionUsd, 1000),
        stop_loss_percent: parseNumber(botStrategyForm.stopLossPercent, 3),
        take_profit_percent: parseNumber(botStrategyForm.takeProfitPercent, 8),
        trailing_stop_percent: parseNumber(botStrategyForm.trailingStopPercent, 2),
        breakeven_activation_percent: parseNumber(botStrategyForm.breakevenPercent, 4),
        cooldown_minutes: Math.max(0, Math.round(parseNumber(botStrategyForm.cooldownMinutes, 60))),
        max_daily_signals: Math.max(1, Math.round(parseNumber(botStrategyForm.maxDailySignals, 5))),
        allowed_symbols: splitCsv(botStrategyForm.allowedSymbols).map((asset) => asset.toUpperCase()),
      },
    });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel criar a estrategia');
      return;
    }
    setBotStrategyForm({
      name: '',
      slug: '',
      type: 'dca',
      status: 'draft',
      description: '',
      marketType: 'spot',
      timeframes: '1h, 4h, 1d',
      exchanges: 'binance, bybit',
      selectedIndicators: [],
      indicatorParameters: {},
      entryIndicator: '',
      entryOutput: 'value',
      entryOperator: 'greater_than',
      entryRightMode: 'value',
      entryCompareIndicator: '',
      entryCompareOutput: 'value',
      entryValue: '0',
      exitIndicator: '',
      exitOutput: 'value',
      exitOperator: 'less_than',
      exitRightMode: 'value',
      exitCompareIndicator: '',
      exitCompareOutput: 'value',
      exitValue: '0',
      maxOrderUsd: '100',
      maxPositionUsd: '1000',
      stopLossPercent: '3',
      takeProfitPercent: '8',
      trailingStopPercent: '2',
      breakevenPercent: '4',
      cooldownMinutes: '60',
      maxDailySignals: '5',
      allowedSymbols: '',
    });
    await reloadCurrentAdminData();
  };

  const updateBotStrategy = async (
    strategy: BotStrategy,
    data: Partial<{ status: string }>
  ) => {
    const result = await api.updateAdminBotStrategy(strategy.id, data);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel atualizar a estrategia');
      return;
    }
    await reloadCurrentAdminData();
  };

  const runBotBacktest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!backtestForm.strategyId || !backtestForm.symbol.trim()) {
      setError('Selecione uma estrategia e um simbolo para rodar o backtest');
      return;
    }
    const initialCapital = Number.parseFloat(backtestForm.initialCapital.replace(',', '.'));
    const result = await api.runAdminBotBacktest(backtestForm.strategyId, {
      symbol: backtestForm.symbol.toUpperCase(),
      timeframe: '1d',
      initial_capital_usd: Number.isFinite(initialCapital) ? initialCapital : 10000,
    });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel rodar o backtest');
      return;
    }
    await reloadCurrentAdminData();
  };

  const createBillingInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountCents = amountToCents(invoiceForm.amount);
    const organizationId = invoiceForm.organizationId || selectedOrganizationId;
    if (!organizationId || amountCents === null || amountCents <= 0) {
      setError('Informe cliente e valor valido para criar a cobranca');
      return;
    }
    const result = await api.createAdminBillingInvoice({
      organization_id: organizationId,
      amount_due_cents: amountCents,
      due_date: invoiceForm.dueDate ? new Date(invoiceForm.dueDate).toISOString() : null,
      notes: invoiceForm.notes || null,
    });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel criar a cobranca');
      return;
    }
    setInvoiceForm({ organizationId: '', amount: '', dueDate: '', notes: '' });
    await reloadCurrentAdminData();
  };

  const registerBillingPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountCents = amountToCents(paymentForm.amount);
    if (!paymentForm.invoiceId || amountCents === null || amountCents <= 0) {
      setError('Informe uma cobranca e um valor valido para registrar pagamento');
      return;
    }
    const result = await api.createAdminBillingPayment({
      invoice_id: paymentForm.invoiceId,
      amount_cents: amountCents,
      notes: paymentForm.notes || null,
    });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel registrar o pagamento');
      return;
    }
    setPaymentForm({ invoiceId: '', amount: '', notes: '' });
    await reloadCurrentAdminData();
  };

  const markInvoicePaid = async (invoice: AdminBillingInvoice) => {
    const remainingCents = Math.max(invoice.amount_due_cents - invoice.amount_paid_cents, 0);
    if (remainingCents <= 0) return;
    const result = await api.createAdminBillingPayment({
      invoice_id: invoice.id,
      amount_cents: remainingCents,
      notes: 'Baixa manual pelo admin',
    });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel baixar a cobranca');
      return;
    }
    await reloadCurrentAdminData();
  };

  const voidBillingInvoice = async (invoice: AdminBillingInvoice) => {
    const result = await api.updateAdminBillingInvoice(invoice.id, { status: 'void' });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel cancelar a cobranca');
      return;
    }
    await reloadCurrentAdminData();
  };

  const createBotTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = botTemplateForm.name.trim();
    const slug = slugify(botTemplateForm.slug || name);
    if (!name || !slug) {
      setError('Informe nome e slug validos para criar o bot produto');
      return;
    }
    const result = await api.createAdminBotTemplate({
      name,
      slug,
      type: botTemplateForm.type,
      status: botTemplateForm.status,
      required_plan: botTemplateForm.requiredPlan as 'free' | 'pro' | 'enterprise',
      description: botTemplateForm.description || null,
      requires_trade_permission: false,
      supported_exchanges: splitCsv(botTemplateForm.supportedExchanges),
      supported_assets: splitCsv(botTemplateForm.supportedAssets).map((asset) => asset.toUpperCase()),
      default_parameters: {},
      risk_notes: botTemplateForm.riskNotes || null,
      strategy_id: botTemplateForm.strategyId || null,
      parameters: [],
    });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel criar o bot produto');
      return;
    }
    setBotTemplateForm({
      name: '',
      slug: '',
      type: 'dca',
      status: 'draft',
      requiredPlan: 'pro',
      description: '',
      supportedExchanges: '',
      supportedAssets: '',
      riskNotes: '',
      strategyId: '',
    });
    await reloadCurrentAdminData();
  };

  const updateBotTemplate = async (
    template: BotTemplate,
    data: Partial<{
      status: string;
      required_plan: 'free' | 'pro' | 'enterprise';
      requires_trade_permission: boolean;
      strategy_id: string | null;
    }>
  ) => {
    const result = await api.updateAdminBotTemplate(template.id, data);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel atualizar o bot produto');
      return;
    }
    await reloadCurrentAdminData();
  };

  const updateBotInstance = async (
    instance: BotInstance,
    statusValue: 'active' | 'paused' | 'disabled'
  ) => {
    const result = await api.updateAdminBotInstance(instance.id, { status: statusValue });
    if (!result.success) {
      setError(result.error || 'Nao foi possivel atualizar o bot do cliente');
      return;
    }
    await reloadCurrentAdminData();
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-primary">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-blue/30 border-t-accent-blue" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (!user?.is_superuser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-primary p-6">
        <Card variant="glass" className="w-full max-w-2xl">
          <CardContent className="py-12 text-center">
            <Shield className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h1 className="text-heading-md text-text-primary">Acesso restrito</h1>
            <p className="mt-2 text-body-sm text-text-secondary">
              Esta area e exclusiva para operadores da plataforma.
            </p>
            <Button className="mt-6" variant="secondary" onClick={() => router.push('/')}>
              Voltar para Connectcoin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-screen transition-colors duration-300',
        isDark
          ? 'bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.08),transparent_30%),var(--bg-primary)]'
          : 'bg-background-primary'
      )}
    >
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen w-72 border-r p-5 backdrop-blur-xl lg:block',
          isDark
            ? 'border-white/[0.06] bg-black/35'
            : 'border-border-subtle bg-background-secondary/90'
        )}
      >
        <div className="mb-8">
          <p className="text-overline uppercase tracking-[0.24em] text-accent-blue">Connectcoin</p>
          <h1 className="mt-2 text-heading-md text-text-primary">Platform Admin</h1>
          <p className="mt-2 text-caption text-text-tertiary">
            Operacao global separada da area do cliente.
          </p>
        </div>

        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-body-sm font-medium transition-colors',
                  active
                    ? 'bg-accent-blue text-white shadow-glow-blue'
                    : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 space-y-2">
          <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4" />
            Voltar ao app cliente
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header
          className={cn(
            'sticky top-0 z-30 border-b px-5 py-4 backdrop-blur-xl transition-colors duration-300',
            isDark
              ? 'border-white/[0.06] bg-black/35'
              : 'border-border-subtle bg-background-primary/85'
          )}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-overline uppercase tracking-[0.22em] text-text-muted">Platform</p>
              <h2 className="mt-1 text-heading-lg text-text-primary">Admin Console</h2>
              <p className="mt-1 text-body-sm text-text-secondary">
                Clientes da plataforma, usuarios, carteiras, auditoria e modulos operacionais.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedOrganizationId}
                options={organizationOptions}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
                className="h-10 min-w-[240px] py-0 text-body-sm"
              />
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                  isDark
                    ? 'border-white/[0.08] bg-white/[0.04] text-accent-yellow hover:bg-white/[0.08]'
                    : 'border-border-subtle bg-background-secondary text-text-secondary hover:border-accent-blue/40 hover:text-text-primary'
                )}
                title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Badge variant="purple">{user.name}</Badge>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl p-5 space-y-6">
          <div className="flex gap-2 overflow-x-auto rounded-xl border border-border-subtle bg-background-secondary/60 p-2 lg:hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-caption font-medium transition-colors',
                    active
                      ? 'bg-accent-blue text-white'
                      : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-body-sm text-status-error">
              {error}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Clientes', overview.organization_count, `${overview.active_organization_count} ativos`],
                ['Usuarios', overview.user_count, `${overview.active_user_count} ativos`],
                ['Carteiras', overview.client_count, 'portfolios gerenciados pelos clientes'],
                ['Auditoria', overview.audit_event_count, 'eventos registrados'],
              ].map(([label, value, caption]) => (
                <Card key={label} variant="glass" className="p-5">
                  <p className="text-caption text-text-muted">{label}</p>
                  <p className="mt-2 text-heading-md text-text-primary">{value}</p>
                  <p className="mt-1 text-caption text-text-tertiary">{caption}</p>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'accounts' && (
            <Card variant="glass">
              <CardHeader>
                <CardTitle>Clientes da plataforma</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-8 text-center text-body-sm text-text-muted">Carregando contas...</div>
                ) : (
                  <div className="space-y-3">
                    {organizations.map((organization) => (
                      <div key={organization.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-heading-sm text-text-primary">{organization.name}</p>
                              <Badge variant={organization.is_active ? 'success' : 'error'} size="sm">
                                {organization.is_active ? 'Ativa' : 'Suspensa'}
                              </Badge>
                              <Badge variant="blue" size="sm">{organization.plan}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-caption text-text-muted">
                              <span>{organization.user_count} membros ativos</span>
                              <span>{organization.team_count} equipes</span>
                              <span>{organization.client_count} carteiras/portfolios</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={organization.plan}
                              options={[
                                { value: 'free', label: 'Free' },
                                { value: 'pro', label: 'Pro' },
                                { value: 'enterprise', label: 'Enterprise' },
                              ]}
                              className="h-9 min-w-[150px] py-0 text-body-sm"
                              onChange={(event) => updateOrganization(organization, {
                                plan: event.target.value as AdminOrganization['plan'],
                              })}
                            />
                            <Button
                              type="button"
                              variant={organization.is_active ? 'danger' : 'secondary'}
                              size="sm"
                              onClick={() => updateOrganization(organization, {
                                is_active: !organization.is_active,
                              })}
                            >
                              {organization.is_active ? 'Suspender' : 'Reativar'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'users' && (
            <Card variant="glass">
              <CardHeader>
                <CardTitle>Usuarios globais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {users.map((targetUser) => (
                  <div key={targetUser.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-heading-sm text-text-primary">{targetUser.name}</p>
                          <Badge variant={targetUser.is_active ? 'success' : 'error'} size="sm">
                            {targetUser.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          {targetUser.is_superuser && <Badge variant="purple" size="sm">Superuser</Badge>}
                        </div>
                        <p className="mt-1 text-caption text-text-muted">{targetUser.email}</p>
                        <div className="mt-3 space-y-2">
                          {(targetUser.memberships || []).length > 0 ? (
                            (targetUser.memberships || []).map((membership) => (
                              <div
                                key={membership.id}
                                className="rounded-lg border border-border-subtle bg-background-primary/70 px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="blue" size="sm">{membership.organization_name}</Badge>
                                  <Badge variant="default" size="sm">{membership.role_name}</Badge>
                                  <Badge variant={membership.status === 'active' ? 'success' : 'yellow'} size="sm">
                                    {membership.status}
                                  </Badge>
                                  <Badge variant="purple" size="sm">
                                    {membership.client_access_mode === 'all' ? 'Todas as carteiras' : 'Escopo especifico'}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-caption text-text-tertiary">
                                  {membership.team_count > 0
                                    ? `Equipes: ${membership.team_names.join(', ')}`
                                    : 'Sem equipe vinculada'}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-caption text-status-warning">Usuario sem membership ativa em conta.</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={targetUser.is_active ? 'danger' : 'secondary'}
                          size="sm"
                          disabled={targetUser.id === user.id}
                          onClick={() => updateUser(targetUser, { is_active: !targetUser.is_active })}
                        >
                          {targetUser.is_active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={targetUser.id === user.id}
                          onClick={() => updateUser(targetUser, { is_superuser: !targetUser.is_superuser })}
                        >
                          {targetUser.is_superuser ? 'Remover superuser' : 'Tornar superuser'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'clients' && (
            <Card variant="glass">
              <CardHeader>
                <CardTitle>Carteiras e portfolios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: client.color }} />
                        <div>
                          <p className="text-heading-sm text-text-primary">{client.name}</p>
                          <p className="text-caption text-text-muted">
                            Cliente da plataforma: {client.organization_name}
                            {client.email ? ` - ${client.email}` : ''}
                          </p>
                          <div className="mt-3 grid gap-2 text-caption text-text-tertiary sm:grid-cols-2">
                            <span>Ultimo scan de wallet: {formatDateTime(client.last_wallet_scan_at)}</span>
                            <span>Ultimo sync de exchange: {formatDateTime(client.last_exchange_sync_at)}</span>
                            <span>Escopo por equipes: {client.team_scope_count}</span>
                            <span>Escopo direto por membros: {client.membership_scope_count}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="blue" size="sm">
                          {client.active_wallet_count}/{client.wallet_count} wallets ativas
                        </Badge>
                        <Badge variant="purple" size="sm">
                          {client.active_exchange_count}/{client.exchange_count} exchanges ativas
                        </Badge>
                        {client.sync_error_count > 0 && (
                          <Badge variant="error" size="sm">{client.sync_error_count} erros de sync</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'audit' && (
            <Card variant="glass">
              <CardHeader>
                <CardTitle>Auditoria global</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default" size="sm">{log.action}</Badge>
                          <p className="text-body-sm font-medium text-text-primary">{log.resource_type}</p>
                        </div>
                        <p className="mt-1 text-caption text-text-secondary">{log.description || 'Evento sem descricao'}</p>
                        <p className="mt-1 text-caption text-text-muted">
                          {log.organization_name || log.organization_id} - {log.user_email || 'system'}
                        </p>
                      </div>
                      <p className="text-caption text-text-muted">{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'strategies' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ['Estrategias', botStrategies.length, 'Motores cadastrados'],
                  ['Publicadas', botStrategies.filter((strategy) => strategy.status === 'published').length, 'Disponiveis para bots'],
                  ['Indicadores', botIndicators.length, 'Catalogo tecnico'],
                  ['Backtests', botBacktests.length, 'Simulacoes executadas'],
                ].map(([label, value, caption]) => (
                  <Card key={label} variant="glass" className="p-5">
                    <p className="text-caption text-text-muted">{label}</p>
                    <p className="mt-2 text-heading-md text-text-primary">{value}</p>
                    <p className="mt-1 text-caption text-text-tertiary">{caption}</p>
                  </Card>
                ))}
              </div>

              <Card variant="glass" className="border-accent-blue/15">
                <CardContent className="grid gap-3 py-5 lg:grid-cols-3">
                  <div>
                    <p className="text-heading-sm text-text-primary">Fluxo correto</p>
                    <p className="mt-1 text-caption text-text-muted">Indicadores sao pecas reutilizaveis; estrategia combina indicadores, regras e risco.</p>
                  </div>
                  <div>
                    <p className="text-heading-sm text-text-primary">Backtest antes de publicar</p>
                    <p className="mt-1 text-caption text-text-muted">Use simulacao para validar comportamento antes de liberar a estrategia para bots.</p>
                  </div>
                  <div>
                    <p className="text-heading-sm text-text-primary">Cliente nao edita o motor</p>
                    <p className="mt-1 text-caption text-text-muted">Cliente ativa bots publicados e ajusta limites dentro do permitido.</p>
                  </div>
                </CardContent>
              </Card>

              <Card variant="glass" className="border-accent-blue/15 bg-gradient-to-br from-background-secondary/80 to-background-primary">
                <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-heading-sm text-text-primary">Strategy Builder</p>
                      <Badge variant="blue" size="sm">{botIndicators.length} indicadores</Badge>
                      <Badge variant="purple" size="sm">{botStrategies.length} estrategias</Badge>
                    </div>
                    <p className="mt-1 max-w-3xl text-body-sm text-text-secondary">
                      Crie a estrategia em um editor visual: identidade, mercado, indicadores, condicoes, risco e backtest em um fluxo compacto.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setStrategyBuilderTab('basic');
                      setIsStrategyBuilderOpen(true);
                    }}
                    className="min-w-[180px]"
                  >
                    Criar estrategia
                  </Button>
                </CardContent>
              </Card>

              {isStrategyBuilderOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
                  <button
                    type="button"
                    aria-label="Fechar editor"
                    className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                    onClick={() => setIsStrategyBuilderOpen(false)}
                  />
                  <div className="relative max-h-[92vh] w-[min(1180px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border-subtle bg-background-primary shadow-2xl">
                    <div className="border-b border-border-subtle bg-background-secondary/80 px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-heading-sm text-text-primary">Editor Visual de Estrategia</p>
                          <p className="mt-1 text-caption text-text-muted">Configure motor, indicadores, regras e backtest sem sair do fluxo.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsStrategyBuilderOpen(false)}
                          className="rounded-lg border border-border-subtle px-3 py-1.5 text-body-sm text-text-secondary transition hover:border-accent-blue hover:text-text-primary"
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          ['basic', 'Configuracao basica'],
                          ['indicators', 'Indicadores'],
                          ['rules', 'Condicoes e risco'],
                          ['backtest', 'Backtest'],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setStrategyBuilderTab(key)}
                            className={[
                              'rounded-lg border px-3 py-2 text-caption font-semibold transition',
                              strategyBuilderTab === key
                                ? 'border-accent-blue bg-accent-blue text-white shadow-sm'
                                : 'border-border-subtle bg-background-primary text-text-secondary hover:border-accent-blue/40 hover:text-text-primary',
                            ].join(' ')}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="max-h-[calc(92vh-132px)] overflow-y-auto p-5">
                      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                <Card variant="glass" className={strategyBuilderTab === 'backtest' ? 'hidden' : ''}>
                  <CardHeader>
                    <CardTitle>Criar estrategia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-5" onSubmit={createBotStrategy}>
                      <section className={[
                        'rounded-2xl border border-border-subtle bg-background-secondary/50 p-4',
                        strategyBuilderTab !== 'basic' ? 'hidden' : '',
                      ].join(' ')}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-heading-sm text-text-primary">1. Identidade</p>
                            <p className="text-caption text-text-muted">Nome, familia operacional e status de publicacao.</p>
                          </div>
                          <Badge variant="blue" size="sm">Builder v1</Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <InfoLabel label="Nome da estrategia" info="Nome humano usado pelo admin e exibido no catalogo de estrategias." />
                            <input
                              value={botStrategyForm.name}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                name: event.target.value,
                                slug: current.slug || slugify(event.target.value),
                              }))}
                              placeholder="Ex: DCA BTC Conservador"
                              className="h-10 w-full rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                            />
                          </div>
                          <div>
                            <InfoLabel label="Slug tecnico" info="Identificador unico da estrategia. Use letras, numeros e hifens." />
                            <input
                              value={botStrategyForm.slug}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                slug: slugify(event.target.value),
                              }))}
                              placeholder="dca-btc-conservador"
                              className="h-10 w-full rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <div>
                            <InfoLabel label="Tipo de estrategia" info="Define a familia do motor. Ex: DCA acumula, Rebalance ajusta alocacao, Signal gera sinais." />
                            <Select
                              value={botStrategyForm.type}
                              options={[
                                { value: 'dca', label: 'DCA' },
                                { value: 'grid', label: 'Grid' },
                                { value: 'rebalance', label: 'Rebalance' },
                                { value: 'signal', label: 'Sinais' },
                                { value: 'arbitrage', label: 'Arbitragem' },
                                { value: 'custom', label: 'Custom' },
                              ]}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                type: event.target.value,
                              }))}
                              className="h-10 py-0 text-body-sm"
                            />
                          </div>
                          <div>
                            <InfoLabel label="Status" info="Rascunho nao aparece para clientes. Publicado fica disponivel para vincular em bots." />
                            <Select
                              value={botStrategyForm.status}
                              options={[
                                { value: 'draft', label: 'Rascunho' },
                                { value: 'published', label: 'Publicado' },
                                { value: 'disabled', label: 'Desativado' },
                              ]}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                status: event.target.value,
                              }))}
                              className="h-10 py-0 text-body-sm"
                            />
                          </div>
                          <div>
                            <InfoLabel label="Mercado" info="Spot por enquanto. Futures/live exigira executor, reconciliacao e travas adicionais." />
                            <Select
                              value={botStrategyForm.marketType}
                              options={[
                                { value: 'spot', label: 'Spot' },
                                { value: 'futures', label: 'Futures (planejado)' },
                                { value: 'paper_only', label: 'Paper only' },
                              ]}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                marketType: event.target.value,
                              }))}
                              className="h-10 py-0 text-body-sm"
                            />
                          </div>
                        </div>
                      </section>

                      <section className={[
                        'rounded-2xl border border-border-subtle bg-background-secondary/50 p-4',
                        strategyBuilderTab !== 'basic' ? 'hidden' : '',
                      ].join(' ')}>
                        <p className="text-heading-sm text-text-primary">2. Mercado e ativos</p>
                        <p className="mb-3 text-caption text-text-muted">Define onde a estrategia pode rodar e quais ativos ela aceita.</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <InfoLabel label="Ativos permitidos" info="Lista de simbolos autorizados. O risco tambem usa essa lista para bloquear sinais fora do escopo." />
                            <input
                              value={botStrategyForm.allowedSymbols}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                allowedSymbols: event.target.value,
                              }))}
                              placeholder="BTC, ETH, SOL"
                              className="h-10 w-full rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                            />
                          </div>
                          <div>
                            <InfoLabel label="Timeframes" info="Candles aceitos no backtest e no motor. Ex: 1h, 4h, 1d." />
                            <input
                              value={botStrategyForm.timeframes}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                timeframes: event.target.value,
                              }))}
                              placeholder="1h, 4h, 1d"
                              className="h-10 w-full rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                            />
                          </div>
                          <div>
                            <InfoLabel label="Exchanges compatíveis" info="Usado depois para filtrar onde o bot pode ser ativado." />
                            <input
                              value={botStrategyForm.exchanges}
                              onChange={(event) => setBotStrategyForm((current) => ({
                                ...current,
                                exchanges: event.target.value,
                              }))}
                              placeholder="binance, bybit"
                              className="h-10 w-full rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                            />
                          </div>
                        </div>
                      </section>

                      <section className={[
                        'rounded-2xl border border-accent-blue/15 bg-gradient-to-br from-background-secondary/80 via-background-primary to-background-secondary/40 p-4 shadow-sm',
                        strategyBuilderTab !== 'indicators' ? 'hidden' : '',
                      ].join(' ')}>
                        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                          <div>
                            <p className="text-heading-sm text-text-primary">3. Indicadores usados</p>
                            <p className="text-caption text-text-muted">
                              Busque, filtre e clique nos sinais tecnicos. Passe o mouse para ver parametros e saidas.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={indicatorSearch}
                              onChange={(event) => setIndicatorSearch(event.target.value)}
                              placeholder="Buscar RSI, EMA, volume..."
                              className="h-9 w-64 rounded-lg border border-border-subtle bg-background-primary/90 px-3 text-caption text-text-primary outline-none transition focus:border-accent-blue"
                            />
                            <Select
                              value={indicatorCategoryFilter}
                              options={[
                                { value: 'all', label: 'Todas categorias' },
                                ...indicatorCategories.map((category) => ({
                                  value: category,
                                  label: indicatorCategoryLabels[category] || category,
                                })),
                              ]}
                              onChange={(event) => setIndicatorCategoryFilter(event.target.value)}
                              className="h-9 w-48 py-0 text-caption"
                            />
                            <span className="rounded-full border border-accent-blue/20 bg-accent-blue/5 px-3 py-1 text-caption font-medium text-accent-blue">
                              {botStrategyForm.selectedIndicators.length} selecionados
                            </span>
                          </div>
                        </div>

                        {selectedStrategyIndicators.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {selectedStrategyIndicators.map((indicator) => (
                              <button
                                key={indicator.key}
                                type="button"
                                onClick={() => setBotStrategyForm((current) => ({
                                  ...current,
                                  selectedIndicators: current.selectedIndicators.filter((key) => key !== indicator.key),
                                  indicatorParameters: Object.fromEntries(
                                    Object.entries(current.indicatorParameters).filter(([key]) => key !== indicator.key)
                                  ),
                                }))}
                                className="rounded-full border border-accent-purple/20 bg-accent-purple/10 px-2.5 py-1 text-caption font-medium text-accent-purple transition hover:border-accent-purple hover:bg-accent-purple/15"
                                title="Remover indicador"
                              >
                                {indicator.name}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                          {filteredIndicators.map((indicator) => {
                            const checked = botStrategyForm.selectedIndicators.includes(indicator.key);
                            const outputs = getIndicatorOutputs(indicator).slice(0, 4);
                            const parameterCount = Object.keys(indicator.parameter_schema || {}).length;
                            return (
                              <button
                                key={indicator.id}
                                type="button"
                                onClick={() => setBotStrategyForm((current) => ({
                                  ...current,
                                  selectedIndicators: checked
                                    ? current.selectedIndicators.filter((key) => key !== indicator.key)
                                    : Array.from(new Set([...current.selectedIndicators, indicator.key])),
                                  indicatorParameters: checked
                                    ? Object.fromEntries(Object.entries(current.indicatorParameters).filter(([key]) => key !== indicator.key))
                                    : {
                                      ...current.indicatorParameters,
                                      [indicator.key]: Object.fromEntries(
                                        Object.entries(getDefaultIndicatorParameters(indicator)).map(([key, value]) => [key, String(value)])
                                      ),
                                    },
                                }))}
                                className={[
                                  'group relative rounded-xl border p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md',
                                  checked
                                    ? 'border-accent-blue bg-accent-blue/10 shadow-sm'
                                    : 'border-border-subtle bg-background-primary/80 hover:border-accent-blue/40 hover:bg-background-primary',
                                ].join(' ')}
                              >
                                <span className="mb-2 flex items-center justify-between gap-2">
                                  <span className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                    {indicatorCategoryLabels[indicator.category] || indicator.category}
                                  </span>
                                  <span className={[
                                    'h-2.5 w-2.5 rounded-full border',
                                    checked ? 'border-accent-blue bg-accent-blue' : 'border-border-strong bg-background-secondary',
                                  ].join(' ')} />
                                </span>
                                <span className="block truncate text-body-sm font-semibold text-text-primary">{indicator.name}</span>
                                <span className="mt-1 block truncate text-caption text-text-muted">{indicator.description || 'Sem descricao cadastrada.'}</span>
                                <span className="mt-2 flex flex-wrap gap-1">
                                  {outputs.map((output) => (
                                    <span key={output} className="rounded-md bg-background-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
                                      {output}
                                    </span>
                                  ))}
                                  <span className="rounded-md bg-background-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
                                    {parameterCount} params
                                  </span>
                                </span>
                                <span className="mt-2 hidden rounded-lg border border-border-subtle bg-background-secondary/70 p-2 text-caption text-text-secondary group-hover:block">
                                  <span className="mb-1 block font-semibold text-text-primary">{indicator.key}</span>
                                  <span className="block">{indicator.description || 'Sem descricao cadastrada.'}</span>
                                  <span className="mt-2 block text-text-muted">
                                    Saidas: {outputs.join(', ') || 'value'} · Parametros: {parameterCount}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {filteredIndicators.length === 0 && (
                          <div className="rounded-xl border border-dashed border-border-subtle bg-background-primary/60 p-6 text-center text-caption text-text-muted">
                            Nenhum indicador encontrado para esse filtro.
                          </div>
                        )}

                        {selectedStrategyIndicators.length > 0 && (
                          <div className="mt-4 rounded-xl border border-border-subtle bg-background-primary/70 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-body-sm font-semibold text-text-primary">Indicadores configurados</p>
                                <p className="text-caption text-text-muted">Ajuste os parametros que serao salvos na estrategia.</p>
                              </div>
                              <Badge variant="blue" size="sm">{selectedStrategyIndicators.length} ativos</Badge>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-2">
                              {selectedStrategyIndicators.map((indicator) => {
                                const parameterEntries = Object.entries(indicator.parameter_schema || {});
                                return (
                                  <div key={indicator.key} className="rounded-lg border border-border-subtle bg-background-secondary/60 p-3">
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-body-sm font-semibold text-text-primary">{indicator.name}</p>
                                        <p className="text-caption text-text-muted">{indicator.key}</p>
                                      </div>
                                      <span className="rounded-full bg-accent-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-purple">
                                        {indicatorCategoryLabels[indicator.category] || indicator.category}
                                      </span>
                                    </div>
                                    {parameterEntries.length > 0 ? (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {parameterEntries.map(([paramKey, schema]) => {
                                          const schemaObject = schema && typeof schema === 'object' ? schema as Record<string, unknown> : {};
                                          const value = botStrategyForm.indicatorParameters[indicator.key]?.[paramKey]
                                            ?? String(schemaObject.default ?? '');
                                          return (
                                            <div key={paramKey}>
                                              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                                                {paramKey}
                                              </label>
                                              <input
                                                value={value}
                                                onChange={(event) => setBotStrategyForm((current) => ({
                                                  ...current,
                                                  indicatorParameters: {
                                                    ...current.indicatorParameters,
                                                    [indicator.key]: {
                                                      ...(current.indicatorParameters[indicator.key] || {}),
                                                      [paramKey]: event.target.value,
                                                    },
                                                  },
                                                }))}
                                                placeholder={String(schemaObject.default ?? '')}
                                                className="h-9 w-full rounded-lg border border-border-subtle bg-background-primary px-3 text-caption text-text-primary outline-none focus:border-accent-blue"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-caption text-text-muted">Sem parametros configuraveis.</p>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-1">
                                      {getIndicatorOutputs(indicator).map((output) => (
                                        <span key={output} className="rounded-md bg-background-primary px-1.5 py-0.5 text-[10px] text-text-secondary">
                                          {output}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </section>

                      <section className={[
                        'rounded-2xl border border-border-subtle bg-background-secondary/50 p-4',
                        strategyBuilderTab !== 'rules' ? 'hidden' : '',
                      ].join(' ')}>
                        <p className="text-heading-sm text-text-primary">4. Regras e condicoes</p>
                        <p className="mb-3 text-caption text-text-muted">
                          As condicoes usam apenas os indicadores selecionados na aba anterior. Ex: RSI.value maior que 70, EMA.value cruza acima de SMA.value.
                        </p>
                        {selectedStrategyIndicators.length === 0 ? (
                          <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-body-sm text-text-secondary">
                            Adicione pelo menos um indicador antes de montar as regras de entrada e saida.
                          </div>
                        ) : (
                          <div className="grid gap-4 lg:grid-cols-2">
                            {[
                              {
                                title: 'Entrada',
                                caption: 'Quando essa condicao for verdadeira, o motor gera sinal de compra/entrada.',
                                side: 'entry',
                                indicator: botStrategyForm.entryIndicator,
                                output: botStrategyForm.entryOutput,
                                operator: botStrategyForm.entryOperator,
                                rightMode: botStrategyForm.entryRightMode,
                                compareIndicator: botStrategyForm.entryCompareIndicator,
                                compareOutput: botStrategyForm.entryCompareOutput,
                                value: botStrategyForm.entryValue,
                              },
                              {
                                title: 'Saida',
                                caption: 'Quando essa condicao for verdadeira, o motor gera sinal de venda/saida.',
                                side: 'exit',
                                indicator: botStrategyForm.exitIndicator,
                                output: botStrategyForm.exitOutput,
                                operator: botStrategyForm.exitOperator,
                                rightMode: botStrategyForm.exitRightMode,
                                compareIndicator: botStrategyForm.exitCompareIndicator,
                                compareOutput: botStrategyForm.exitCompareOutput,
                                value: botStrategyForm.exitValue,
                              },
                            ].map((rule) => {
                              const leftIndicator = botIndicators.find((item) => item.key === rule.indicator);
                              const rightIndicator = botIndicators.find((item) => item.key === rule.compareIndicator);
                              const prefix = rule.side === 'entry' ? 'entry' : 'exit';
                              return (
                                <div key={rule.side} className="rounded-xl border border-border-subtle bg-background-primary/80 p-4">
                                  <div className="mb-3">
                                    <p className="text-body-sm font-semibold text-text-primary">{rule.title}</p>
                                    <p className="text-caption text-text-muted">{rule.caption}</p>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="grid gap-2 md:grid-cols-[1.1fr_0.8fr]">
                                      <div>
                                        <InfoLabel label="Indicador" info="Escolha um dos indicadores adicionados na estrategia." />
                                        <Select
                                          value={rule.indicator}
                                          options={[{ value: '', label: `Indicador de ${rule.title.toLowerCase()}` }, ...selectedIndicatorOptions]}
                                          onChange={(event) => {
                                            const indicator = botIndicators.find((item) => item.key === event.target.value);
                                            setBotStrategyForm((current) => ({
                                              ...current,
                                              [`${prefix}Indicator`]: event.target.value,
                                              [`${prefix}Output`]: getIndicatorOutputs(indicator)[0] || 'value',
                                            }));
                                          }}
                                          className="h-10 py-0 text-body-sm"
                                        />
                                      </div>
                                      <div>
                                        <InfoLabel label="Saida do indicador" info="Campo calculado pelo indicador escolhido. Ex: value, upper, lower, signal, histogram." />
                                        <Select
                                          value={rule.output}
                                          options={getIndicatorOutputs(leftIndicator).map((output) => ({ value: output, label: output }))}
                                          onChange={(event) => setBotStrategyForm((current) => ({
                                            ...current,
                                            [`${prefix}Output`]: event.target.value,
                                          }))}
                                          className="h-10 py-0 text-body-sm"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-[0.8fr_0.7fr_1fr]">
                                      <div>
                                        <InfoLabel label="Operador" info="Como comparar o lado esquerdo com o lado direito." />
                                        <Select
                                          value={rule.operator}
                                          options={strategyOperatorOptions}
                                          onChange={(event) => setBotStrategyForm((current) => ({
                                            ...current,
                                            [`${prefix}Operator`]: event.target.value,
                                          }))}
                                          className="h-10 py-0 text-body-sm"
                                        />
                                      </div>
                                      <div>
                                        <InfoLabel label="Comparar com" info="Use valor fixo ou compare com outro indicador selecionado." />
                                        <Select
                                          value={rule.rightMode}
                                          options={[
                                            { value: 'value', label: 'Valor fixo' },
                                            { value: 'indicator', label: 'Outro indicador' },
                                          ]}
                                          onChange={(event) => setBotStrategyForm((current) => ({
                                            ...current,
                                            [`${prefix}RightMode`]: event.target.value,
                                          }))}
                                          className="h-10 py-0 text-body-sm"
                                        />
                                      </div>
                                      {rule.rightMode === 'indicator' ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                          <Select
                                            value={rule.compareIndicator}
                                            options={[{ value: '', label: 'Indicador comparado' }, ...selectedIndicatorOptions]}
                                            onChange={(event) => {
                                              const indicator = botIndicators.find((item) => item.key === event.target.value);
                                              setBotStrategyForm((current) => ({
                                                ...current,
                                                [`${prefix}CompareIndicator`]: event.target.value,
                                                [`${prefix}CompareOutput`]: getIndicatorOutputs(indicator)[0] || 'value',
                                              }));
                                            }}
                                            className="h-10 py-0 text-body-sm"
                                          />
                                          <Select
                                            value={rule.compareOutput}
                                            options={getIndicatorOutputs(rightIndicator).map((output) => ({ value: output, label: output }))}
                                            onChange={(event) => setBotStrategyForm((current) => ({
                                              ...current,
                                              [`${prefix}CompareOutput`]: event.target.value,
                                            }))}
                                            className="h-10 py-0 text-body-sm"
                                          />
                                        </div>
                                      ) : (
                                        <input
                                          value={rule.value}
                                          onChange={(event) => setBotStrategyForm((current) => ({
                                            ...current,
                                            [`${prefix}Value`]: event.target.value,
                                          }))}
                                          placeholder="Ex: 70"
                                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                                        />
                                      )}
                                    </div>
                                    <div className="rounded-lg border border-border-subtle bg-background-secondary/70 px-3 py-2 text-caption text-text-secondary">
                                      SE {leftIndicator?.name || 'indicador'} . {rule.output || 'value'} {strategyOperatorOptions.find((item) => item.value === rule.operator)?.label || rule.operator}{' '}
                                      {rule.rightMode === 'indicator'
                                        ? `${rightIndicator?.name || 'outro indicador'} . ${rule.compareOutput || 'value'}`
                                        : rule.value || '0'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>

                      <section className={[
                        'rounded-2xl border border-border-subtle bg-background-secondary/50 p-4',
                        strategyBuilderTab !== 'rules' ? 'hidden' : '',
                      ].join(' ')}>
                        <p className="text-heading-sm text-text-primary">5. Risco operacional</p>
                        <p className="mb-3 text-caption text-text-muted">Esses limites sao aplicados pelo motor antes de gerar sinal.</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          {[
                            ['maxOrderUsd', 'Max ordem USD', 'Valor maximo por sinal/ordem simulada.', botStrategyForm.maxOrderUsd],
                            ['maxPositionUsd', 'Max posicao USD', 'Exposicao maxima permitida no ativo.', botStrategyForm.maxPositionUsd],
                            ['stopLossPercent', 'Stop loss %', 'Perda maxima por posicao antes de sair.', botStrategyForm.stopLossPercent],
                            ['takeProfitPercent', 'Take profit %', 'Alvo de lucro para saida parcial/total.', botStrategyForm.takeProfitPercent],
                            ['trailingStopPercent', 'Trailing stop %', 'Distancia dinamica para proteger lucro quando o preco anda a favor.', botStrategyForm.trailingStopPercent],
                            ['breakevenPercent', 'Breakeven apos %', 'Move protecao para preco de entrada depois desse ganho.', botStrategyForm.breakevenPercent],
                            ['cooldownMinutes', 'Cooldown minutos', 'Tempo minimo entre sinais para evitar overtrading.', botStrategyForm.cooldownMinutes],
                            ['maxDailySignals', 'Max sinais/dia', 'Limite diario de sinais acionaveis. HOLD nao conta.', botStrategyForm.maxDailySignals],
                          ].map(([key, label, info, value]) => (
                            <div key={key}>
                              <InfoLabel label={label} info={info} />
                              <input
                                value={value}
                                onChange={(event) => setBotStrategyForm((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))}
                                className="h-10 w-full rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                              />
                            </div>
                          ))}
                        </div>
                      </section>

                      <div className={strategyBuilderTab !== 'rules' ? 'hidden' : ''}>
                        <InfoLabel label="Descricao operacional" info="Explique a tese da estrategia, quando ela deve operar e quais riscos o admin precisa lembrar." />
                        <textarea
                          value={botStrategyForm.description}
                          onChange={(event) => setBotStrategyForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))}
                          placeholder="Ex: Usa RSI + EMA para comprar sobrevenda em tendencia primaria positiva; sai por take profit, trailing ou perda de momentum."
                          className="min-h-24 w-full rounded-lg border border-border-subtle bg-background-primary px-3 py-2 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                        <p className="text-caption text-text-muted">
                          {botStrategyForm.selectedIndicators.length} indicadores - Entrada: {botStrategyForm.entryIndicator || 'nao definida'} - Saida: {botStrategyForm.exitIndicator || 'nao definida'}
                        </p>
                        <Button type="submit">Salvar estrategia</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card variant="glass" className={strategyBuilderTab !== 'backtest' ? 'hidden' : ''}>
                  <CardHeader>
                    <CardTitle>Rodar backtest</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-3" onSubmit={runBotBacktest}>
                      <Select
                        value={backtestForm.strategyId}
                        options={[
                          { value: '', label: 'Selecione uma estrategia' },
                          ...botStrategies.map((strategy) => ({
                            value: strategy.id,
                            label: `${strategy.name} v${strategy.version}`,
                          })),
                        ]}
                        onChange={(event) => setBacktestForm((current) => ({
                          ...current,
                          strategyId: event.target.value,
                        }))}
                        className="h-10 py-0 text-body-sm"
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={backtestForm.symbol}
                          onChange={(event) => setBacktestForm((current) => ({
                            ...current,
                            symbol: event.target.value.toUpperCase(),
                          }))}
                          placeholder="BTC"
                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                        <input
                          value={backtestForm.initialCapital}
                          onChange={(event) => setBacktestForm((current) => ({
                            ...current,
                            initialCapital: event.target.value,
                          }))}
                          placeholder="Capital inicial USD"
                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </div>
                      <Button type="submit">Executar backtest</Button>
                    </form>
                    <div className="mt-5 space-y-3">
                      {botBacktests.slice(0, 5).map((backtest) => (
                        <div key={backtest.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-heading-sm text-text-primary">{backtest.name}</p>
                            <Badge variant={backtest.status === 'succeeded' ? 'success' : backtest.status === 'failed' ? 'error' : 'yellow'} size="sm">
                              {backtest.status}
                            </Badge>
                            <Badge variant="blue" size="sm">{backtest.symbol}</Badge>
                          </div>
                          <p className="mt-2 text-caption text-text-secondary">
                            Retorno: {String(backtest.result_summary.total_return_percent ?? 'n/a')}% - Trades: {String(backtest.result_summary.trade_count ?? 0)}
                          </p>
                          {backtest.error && <p className="mt-1 text-caption text-status-error">{backtest.error}</p>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Estrategias cadastradas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {botStrategies.length === 0 && (
                    <p className="py-6 text-center text-body-sm text-text-muted">Nenhuma estrategia criada ainda.</p>
                  )}
                  {botStrategies.map((strategy) => (
                    <div key={strategy.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-heading-sm text-text-primary">{strategy.name}</p>
                            <Badge variant={strategy.status === 'published' ? 'success' : strategy.status === 'disabled' ? 'error' : 'yellow'} size="sm">
                              {strategy.status}
                            </Badge>
                            <Badge variant="purple" size="sm">{strategy.type}</Badge>
                            <Badge variant="blue" size="sm">v{strategy.version}</Badge>
                          </div>
                          <p className="mt-1 text-caption text-text-muted">{strategy.description || 'Sem descricao.'}</p>
                          <p className="mt-2 text-caption text-text-tertiary">
                            {strategy.template_count} produtos - {strategy.instance_count} instancias - {strategy.backtest_count} backtests
                          </p>
                        </div>
                        <Select
                          value={strategy.status}
                          options={[
                            { value: 'draft', label: 'Rascunho' },
                            { value: 'published', label: 'Publicado' },
                            { value: 'disabled', label: 'Desativado' },
                          ]}
                          onChange={(event) => updateBotStrategy(strategy, { status: event.target.value })}
                          className="h-9 min-w-[150px] py-0 text-body-sm"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
          {activeTab === 'bots' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Produtos', botTemplates.length, 'Bots criados pela plataforma'],
                  ['Publicados', botTemplates.filter((template) => template.status === 'published').length, 'Disponiveis para clientes'],
                  ['Instancias', botInstances.length, 'Ativacoes em contas de clientes'],
                ].map(([label, value, caption]) => (
                  <Card key={label} variant="glass" className="p-5">
                    <p className="text-caption text-text-muted">{label}</p>
                    <p className="mt-2 text-heading-md text-text-primary">{value}</p>
                    <p className="mt-1 text-caption text-text-tertiary">{caption}</p>
                  </Card>
                ))}
              </div>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Criar Bot Produto</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3" onSubmit={createBotTemplate}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={botTemplateForm.name}
                        onChange={(event) => setBotTemplateForm((current) => ({
                          ...current,
                          name: event.target.value,
                          slug: current.slug || slugify(event.target.value),
                        }))}
                        placeholder="Nome do bot. Ex: DCA Bitcoin Conservador"
                        className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                      <input
                        value={botTemplateForm.slug}
                        onChange={(event) => setBotTemplateForm((current) => ({
                          ...current,
                          slug: slugify(event.target.value),
                        }))}
                        placeholder="slug-do-bot"
                        className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select
                        value={botTemplateForm.type}
                        options={[
                          { value: 'dca', label: 'DCA' },
                          { value: 'grid', label: 'Grid' },
                          { value: 'rebalance', label: 'Rebalance' },
                          { value: 'signal', label: 'Sinais' },
                          { value: 'arbitrage', label: 'Arbitragem' },
                          { value: 'custom', label: 'Custom' },
                        ]}
                        onChange={(event) => setBotTemplateForm((current) => ({
                          ...current,
                          type: event.target.value,
                        }))}
                        className="h-10 py-0 text-body-sm"
                      />
                      <Select
                        value={botTemplateForm.requiredPlan}
                        options={[
                          { value: 'free', label: 'Free' },
                          { value: 'pro', label: 'Pro' },
                          { value: 'enterprise', label: 'Enterprise' },
                        ]}
                        onChange={(event) => setBotTemplateForm((current) => ({
                          ...current,
                          requiredPlan: event.target.value,
                        }))}
                        className="h-10 py-0 text-body-sm"
                      />
                      <Select
                        value={botTemplateForm.status}
                        options={[
                          { value: 'draft', label: 'Rascunho' },
                          { value: 'published', label: 'Publicado' },
                          { value: 'disabled', label: 'Desativado' },
                        ]}
                        onChange={(event) => setBotTemplateForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))}
                        className="h-10 py-0 text-body-sm"
                      />
                    </div>
                    <Select
                      value={botTemplateForm.strategyId}
                      options={[
                        { value: '', label: 'Sem estrategia vinculada' },
                        ...botStrategies.map((strategy) => ({
                          value: strategy.id,
                          label: `${strategy.name} v${strategy.version}`,
                        })),
                      ]}
                      onChange={(event) => setBotTemplateForm((current) => ({
                        ...current,
                        strategyId: event.target.value,
                      }))}
                      className="h-10 py-0 text-body-sm"
                    />
                    <textarea
                      value={botTemplateForm.description}
                      onChange={(event) => setBotTemplateForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))}
                      placeholder="Descricao para o cliente entender quando ativar esse bot"
                      className="min-h-20 rounded-lg border border-border-subtle bg-background-primary px-3 py-2 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={botTemplateForm.supportedExchanges}
                        onChange={(event) => setBotTemplateForm((current) => ({
                          ...current,
                          supportedExchanges: event.target.value,
                        }))}
                        placeholder="Exchanges suportadas: bybit, binance"
                        className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                      <input
                        value={botTemplateForm.supportedAssets}
                        onChange={(event) => setBotTemplateForm((current) => ({
                          ...current,
                          supportedAssets: event.target.value,
                        }))}
                        placeholder="Ativos suportados: BTC, ETH, SOL"
                        className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                    </div>
                    <textarea
                      value={botTemplateForm.riskNotes}
                      onChange={(event) => setBotTemplateForm((current) => ({
                        ...current,
                        riskNotes: event.target.value,
                      }))}
                      placeholder="Notas de risco e operacao interna"
                      className="min-h-20 rounded-lg border border-border-subtle bg-background-primary px-3 py-2 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                    />
                    <Button type="submit">Criar bot produto</Button>
                  </form>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Catalogo de bots</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {botTemplates.length === 0 && (
                      <p className="py-6 text-center text-body-sm text-text-muted">Nenhum bot produto criado ainda.</p>
                    )}
                    {botTemplates.map((template) => (
                      <div key={template.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-heading-sm text-text-primary">{template.name}</p>
                              <Badge variant={template.status === 'published' ? 'success' : template.status === 'disabled' ? 'error' : 'yellow'} size="sm">
                                {template.status}
                              </Badge>
                              <Badge variant="purple" size="sm">{template.type}</Badge>
                              <Badge variant="blue" size="sm">{template.required_plan}</Badge>
                              {template.strategy_name && <Badge variant="success" size="sm">{template.strategy_name}</Badge>}
                            </div>
                            <p className="mt-1 text-caption text-text-muted">{template.description || 'Sem descricao publica.'}</p>
                            <p className="mt-2 text-caption text-text-tertiary">
                              {template.total_instance_count} instancias - {template.active_instance_count} ativas
                            </p>
                          </div>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Select
                              value={template.status}
                              options={[
                                { value: 'draft', label: 'Rascunho' },
                                { value: 'published', label: 'Publicado' },
                                { value: 'disabled', label: 'Desativado' },
                                { value: 'archived', label: 'Arquivado' },
                              ]}
                              onChange={(event) => updateBotTemplate(template, { status: event.target.value })}
                              className="h-9 min-w-[140px] py-0 text-body-sm"
                            />
                            <Select
                              value={template.required_plan}
                              options={[
                                { value: 'free', label: 'Free' },
                                { value: 'pro', label: 'Pro' },
                                { value: 'enterprise', label: 'Enterprise' },
                              ]}
                              onChange={(event) => updateBotTemplate(template, {
                                required_plan: event.target.value as 'free' | 'pro' | 'enterprise',
                              })}
                              className="h-9 min-w-[140px] py-0 text-body-sm"
                            />
                            <Select
                              value={template.strategy_id || ''}
                              options={[
                                { value: '', label: 'Sem estrategia' },
                                ...botStrategies.map((strategy) => ({
                                  value: strategy.id,
                                  label: strategy.name,
                                })),
                              ]}
                              onChange={(event) => updateBotTemplate(template, {
                                strategy_id: event.target.value || null,
                              })}
                              className="h-9 min-w-[160px] py-0 text-body-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Instancias de clientes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {botInstances.length === 0 && (
                      <p className="py-6 text-center text-body-sm text-text-muted">Nenhum cliente ativou bots ainda.</p>
                    )}
                    {botInstances.map((instance) => (
                      <div key={instance.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-heading-sm text-text-primary">{instance.name}</p>
                              <Badge variant={instance.status === 'active' ? 'success' : instance.status === 'error' ? 'error' : 'yellow'} size="sm">
                                {instance.status}
                              </Badge>
                              <Badge variant="purple" size="sm">{instance.mode}</Badge>
                              {instance.strategy_name && <Badge variant="blue" size="sm">{instance.strategy_name}</Badge>}
                            </div>
                            <p className="mt-1 text-caption text-text-muted">
                              Cliente: {instance.organization_name || 'Conta'} - Carteira: {instance.client_name}
                            </p>
                            <p className="mt-1 text-caption text-text-tertiary">
                              Produto: {instance.template_name || 'Template removido'} - Exchange: {instance.exchange_name || 'Nao vinculada'}
                            </p>
                            <p className="mt-1 text-caption text-text-tertiary">
                              Ultimo ciclo: {formatDateTime(instance.last_run_at)} - Max ordem: ${String(instance.risk_config.max_order_usd || 0)}
                            </p>
                            {instance.last_error && (
                              <p className="mt-2 text-caption text-status-error">{instance.last_error}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={instance.status === 'paused'}
                              onClick={() => updateBotInstance(instance, 'paused')}
                            >
                              Pausar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={instance.status === 'disabled'}
                              onClick={() => updateBotInstance(instance, 'disabled')}
                            >
                              Desabilitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['MRR', formatMoney(financeSummary.mrr_cents, financeSummary.currency), 'Receita recorrente ativa'],
                  ['Aberto', formatMoney(financeSummary.open_amount_cents, financeSummary.currency), `${financeSummary.open_invoice_count} cobrancas abertas`],
                  ['Vencido', formatMoney(financeSummary.overdue_amount_cents, financeSummary.currency), `${financeSummary.overdue_invoice_count} cobrancas vencidas`],
                  ['Pago 30d', formatMoney(financeSummary.paid_amount_30d_cents, financeSummary.currency), 'Recebido nos ultimos 30 dias'],
                ].map(([label, value, caption]) => (
                  <Card key={label} variant="glass" className="p-5">
                    <p className="text-caption text-text-muted">{label}</p>
                    <p className="mt-2 text-heading-md text-text-primary">{value}</p>
                    <p className="mt-1 text-caption text-text-tertiary">{caption}</p>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Criar cobranca manual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-3" onSubmit={createBillingInvoice}>
                      <Select
                        value={invoiceForm.organizationId || selectedOrganizationId}
                        options={organizationOptions.filter((option) => option.value)}
                        onChange={(event) => setInvoiceForm((current) => ({
                          ...current,
                          organizationId: event.target.value,
                        }))}
                        className="h-10 py-0 text-body-sm"
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={invoiceForm.amount}
                          onChange={(event) => setInvoiceForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))}
                          placeholder="Valor em R$"
                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                        <input
                          type="date"
                          value={invoiceForm.dueDate}
                          onChange={(event) => setInvoiceForm((current) => ({
                            ...current,
                            dueDate: event.target.value,
                          }))}
                          className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                        />
                      </div>
                      <textarea
                        value={invoiceForm.notes}
                        onChange={(event) => setInvoiceForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))}
                        placeholder="Notas internas"
                        className="min-h-20 rounded-lg border border-border-subtle bg-background-primary px-3 py-2 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                      <Button type="submit">Criar cobranca</Button>
                    </form>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Registrar pagamento manual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-3" onSubmit={registerBillingPayment}>
                      <Select
                        value={paymentForm.invoiceId}
                        options={[
                          { value: '', label: 'Selecione uma cobranca' },
                          ...billingInvoices
                            .filter((invoice) => !['paid', 'void'].includes(invoice.status))
                            .map((invoice) => ({
                              value: invoice.id,
                              label: `${invoice.organization_name} - ${formatMoney(invoice.amount_due_cents - invoice.amount_paid_cents, invoice.currency)}`,
                            })),
                        ]}
                        onChange={(event) => setPaymentForm((current) => ({
                          ...current,
                          invoiceId: event.target.value,
                        }))}
                        className="h-10 py-0 text-body-sm"
                      />
                      <input
                        value={paymentForm.amount}
                        onChange={(event) => setPaymentForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))}
                        placeholder="Valor em R$"
                        className="h-10 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                      <textarea
                        value={paymentForm.notes}
                        onChange={(event) => setPaymentForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))}
                        placeholder="Notas internas"
                        className="min-h-20 rounded-lg border border-border-subtle bg-background-primary px-3 py-2 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                      />
                      <Button type="submit">Registrar pagamento</Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Assinaturas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {billingSubscriptions.map((subscription) => (
                    <div key={subscription.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-heading-sm text-text-primary">{subscription.organization_name}</p>
                            <Badge
                              variant={subscription.status === 'active' ? 'success' : subscription.status === 'past_due' ? 'error' : 'yellow'}
                              size="sm"
                            >
                              {subscription.status}
                            </Badge>
                            <Badge variant="purple" size="sm">{subscription.provider}</Badge>
                          </div>
                          <p className="mt-1 text-caption text-text-muted">
                            {subscription.billing_email || 'Sem email de cobranca'} - {formatMoney(subscription.monthly_amount_cents, subscription.currency)}/mes
                          </p>
                        </div>
                        <div className="grid gap-2 md:grid-cols-4">
                          <Select
                            value={subscription.plan}
                            options={[
                              { value: 'free', label: 'Free' },
                              { value: 'pro', label: 'Pro' },
                              { value: 'enterprise', label: 'Enterprise' },
                            ]}
                            onChange={(event) => updateBillingSubscription(subscription, {
                              plan: event.target.value as AdminBillingSubscription['plan'],
                            })}
                            className="h-9 min-w-[130px] py-0 text-body-sm"
                          />
                          <Select
                            value={subscription.status}
                            options={[
                              { value: 'trialing', label: 'Trial' },
                              { value: 'active', label: 'Ativa' },
                              { value: 'past_due', label: 'Vencida' },
                              { value: 'unpaid', label: 'Inadimplente' },
                              { value: 'canceled', label: 'Cancelada' },
                            ]}
                            onChange={(event) => updateBillingSubscription(subscription, {
                              status: event.target.value,
                            })}
                            className="h-9 min-w-[150px] py-0 text-body-sm"
                          />
                          <input
                            defaultValue={(subscription.monthly_amount_cents / 100).toFixed(2)}
                            onBlur={(event) => {
                              const cents = amountToCents(event.target.value);
                              if (cents !== null && cents !== subscription.monthly_amount_cents) {
                                updateBillingSubscription(subscription, { monthly_amount_cents: cents });
                              }
                            }}
                            className="h-9 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                          />
                          <input
                            defaultValue={subscription.billing_email || ''}
                            placeholder="Email cobranca"
                            onBlur={(event) => updateBillingSubscription(subscription, {
                              billing_email: event.target.value || null,
                            })}
                            className="h-9 rounded-lg border border-border-subtle bg-background-primary px-3 text-body-sm text-text-primary outline-none focus:border-accent-blue"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Cobrancas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {billingInvoices.length === 0 && (
                    <p className="py-6 text-center text-body-sm text-text-muted">Nenhuma cobranca criada ainda.</p>
                  )}
                  {billingInvoices.map((invoice) => {
                    const remainingCents = Math.max(invoice.amount_due_cents - invoice.amount_paid_cents, 0);
                    return (
                      <div key={invoice.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-heading-sm text-text-primary">{invoice.organization_name}</p>
                              <Badge
                                variant={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'error' : 'yellow'}
                                size="sm"
                              >
                                {invoice.status}
                              </Badge>
                              {invoice.number && <Badge variant="default" size="sm">{invoice.number}</Badge>}
                            </div>
                            <p className="mt-1 text-caption text-text-muted">
                              Total {formatMoney(invoice.amount_due_cents, invoice.currency)} - pago {formatMoney(invoice.amount_paid_cents, invoice.currency)} - restante {formatMoney(remainingCents, invoice.currency)}
                            </p>
                            <p className="mt-1 text-caption text-text-tertiary">
                              Vencimento: {formatDateTime(invoice.due_date)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={remainingCents <= 0 || invoice.status === 'void'}
                              onClick={() => markInvoicePaid(invoice)}
                            >
                              Baixar total
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={invoice.status === 'paid' || invoice.status === 'void'}
                              onClick={() => voidBillingInvoice(invoice)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Pagamentos recentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {billingPayments.length === 0 && (
                    <p className="py-6 text-center text-body-sm text-text-muted">Nenhum pagamento registrado ainda.</p>
                  )}
                  {billingPayments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-heading-sm text-text-primary">{payment.organization_name}</p>
                            <Badge variant={payment.status === 'succeeded' ? 'success' : payment.status === 'failed' ? 'error' : 'yellow'} size="sm">
                              {payment.status}
                            </Badge>
                            <Badge variant="purple" size="sm">{payment.provider}</Badge>
                          </div>
                          <p className="mt-1 text-caption text-text-muted">
                            {formatMoney(payment.amount_cents, payment.currency)} - {formatDateTime(payment.paid_at)}
                          </p>
                          {payment.notes && <p className="mt-1 text-caption text-text-tertiary">{payment.notes}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                {planDefinitions.map((plan) => (
                  <Card key={plan.plan} variant="glass" className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge variant="blue" size="sm">{plan.plan}</Badge>
                        <h2 className="mt-3 text-heading-md text-text-primary">{plan.label}</h2>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {Object.entries(planMetricLabels).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between text-caption">
                          <span className="text-text-tertiary">{label}</span>
                          <span className="font-medium text-text-primary">{formatLimit(plan.limits[key])}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 space-y-2">
                      {plan.features.map((feature) => (
                        <p key={feature} className="text-caption text-text-secondary">- {feature}</p>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Uso dos clientes por plano</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {planUsages.map((usage) => (
                    <div key={usage.organization_id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-heading-sm text-text-primary">{usage.organization_name}</p>
                            <Badge variant="purple" size="sm">{usage.plan}</Badge>
                          </div>
                          <p className="mt-1 text-caption text-text-muted">
                            Limites contam membros ativos + convites pendentes para evitar overbooking.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(planMetricLabels).map(([key, label]) => {
                          const limit = usage.limits[key];
                          const current = usage.usage[key] || 0;
                          const overLimit = usage.over_limit[key];
                          return (
                            <div
                              key={key}
                              className={cn(
                                'rounded-lg border px-3 py-2',
                                overLimit
                                  ? 'border-status-error/30 bg-status-error/10'
                                  : 'border-border-subtle bg-background-primary/70'
                              )}
                            >
                              <p className="text-caption text-text-tertiary">{label}</p>
                              <p className="mt-1 text-body-sm font-semibold text-text-primary">
                                {current} / {formatLimit(limit)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
          {activeTab === 'system' && (
            <PlaceholderSection
              title="Sistema"
              description="Area futura para health checks, filas, workers, cache, migrations e integracoes operacionais."
            />
          )}
        </div>
      </main>
    </div>
  );
}
