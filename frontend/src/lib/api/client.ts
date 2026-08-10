/**
 * API Client for backend communication
 */

// Use relative paths — Next.js proxy rewrites /api/* to backend
const API_URL = '';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'active_account_id';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

function stringifyApiErrorValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return stringifyApiErrorValue(record.msg || record.message || record.detail || record.error);
        }
        return stringifyApiErrorValue(item);
      })
      .filter((item): item is string => Boolean(item));

    return messages.length ? messages.join('; ') : null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = stringifyApiErrorValue(record.message || record.detail || record.error || record.msg);
    if (nested) return nested;

    try {
      return JSON.stringify(value);
    } catch {
      return 'Erro inesperado';
    }
  }

  return null;
}

function normalizeApiError(errorData: unknown, status: number): string {
  if (errorData && typeof errorData === 'object') {
    const record = errorData as Record<string, unknown>;
    return (
      stringifyApiErrorValue(record.message)
      || stringifyApiErrorValue(record.detail)
      || stringifyApiErrorValue(record.error)
      || `HTTP ${status}`
    );
  }

  return stringifyApiErrorValue(errorData) || `HTTP ${status}`;
}

interface WalletData {
  id: string;
  address: string;
  network: string;
  chain: string;
  label: string;
  is_active: boolean;
  added_at: string;
  last_scan_at: string | null;
  client_id: string;
}

interface ClientData {
  id: string;
  name: string;
  email: string | null;
  color: string;
  created_at: string;
}

// Portfolio list item (from GET /clients)
interface ClientListItem {
  id: string;
  name: string;
  email: string | null;
  color: string;
  total_value_usd: number | string;
  pnl_24h_percent: number | string;
  wallet_count: number;
  exchange_count: number;
  position_count: number;
  pending_rewards_usd: number | string;
  average_apy: number | string;
}

interface ClientObservation {
  id: string;
  organization_id: string;
  client_id: string;
  created_by_user_id: string | null;
  observed_at: string;
  location: string | null;
  asset_type: string | null;
  asset_symbol: string | null;
  amount: number | string | null;
  value_usd: number | string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

interface ClientObservationCreateData {
  observed_at: string;
  location?: string | null;
  asset_type?: string | null;
  asset_symbol?: string | null;
  amount?: number | null;
  value_usd?: number | null;
  note: string;
}

// Full portfolio (from GET /clients/{id}/portfolio)
interface ClientPortfolioData {
  client: {
    id: string;
    name: string;
    email: string | null;
    notes: string | null;
    color: string;
    organization_id: string;
    created_at: string;
    updated_at: string;
  };
  wallets: Array<{
    id: string;
    client_id: string;
    address: string;
    network: string;
    chain: string;
    label: string;
    is_active: boolean;
    added_at: string;
    last_scan_at: string | null;
    total_value_usd: number | string;
    token_count: number;
    tokens: Array<{
      symbol: string;
      name: string;
      contract_address: string | null;
      balance: number | string;
      balance_usd: number | string;
      price_usd: number | string;
      price_change_24h: number | string;
      logo_url: string | null;
    }>;
  }>;
  exchanges: Array<{
    id: string;
    client_id: string;
    exchange: string;
    label: string;
    api_key_masked: string;
    is_active: boolean;
    added_at: string;
    last_sync_at: string | null;
    sync_error: string | null;
    total_value_usd: number | string;
    asset_count: number;
    balances: Array<{
      asset: string;
      free: number | string;
      locked: number | string;
      total: number | string;
      value_usd: number | string;
      price_usd: number | string;
      change_24h: number | string;
      entry_price: number | string | null;
      cost_basis: number | string | null;
      unrealized_pnl: number | string;
      unrealized_pnl_percent: number | string;
      apy: number | string | null;
      position_type: string | null;
    }>;
  }>;
  manual_assets: Array<{
    id: string;
    client_id: string;
    token: string;
    token_name: string;
    network: string;
    quantity: number | string;
    purchase_price: number | string;
    purchase_date: string;
    current_price: number | string | null;
    type: string;
    staking_provider: string | null;
    apy: number | string | null;
    notes: string | null;
    current_value_usd: number | string;
    cost_basis: number | string;
    unrealized_pnl: number | string;
    unrealized_pnl_percent: number | string;
    created_at: string;
    updated_at: string;
  }>;
  staking_positions: Array<Record<string, unknown>>;
  pool_positions: Array<Record<string, unknown>>;
  summary: {
    total_value_usd: number | string;
    total_holding_usd: number | string;
    total_staking_usd: number | string;
    total_lending_usd: number | string;
    total_lp_usd: number | string;
    total_pnl_usd: number | string;
    total_pnl_percent: number | string;
    pnl_24h_usd: number | string;
    pnl_24h_percent: number | string;
    pending_rewards_usd: number | string;
    claimed_rewards_usd: number | string;
    average_apy: number | string;
    estimated_yearly_yield: number | string;
    total_fees_earned_usd: number | string;
    total_il_usd: number | string;
    asset_count: number;
    wallet_count: number;
    exchange_count: number;
    staking_position_count: number;
    lp_position_count: number;
    manual_asset_count: number;
    allocation_by_type: Record<string, number>;
    allocation_by_chain: Record<string, number>;
    allocation_by_asset: Record<string, number>;
  };
}

// Exchange create/sync types
interface ExchangeCreateData {
  exchange: string;
  label: string;
  api_key: string;
  api_secret: string;
}

interface ExchangeUpdateData {
  label?: string;
  initial_balance_usd?: number | null;
}

interface ExchangeSyncResult {
  exchange_id: string;
  assets_synced: number;
  total_value_usd: number | string;
  sync_time_ms: number;
}

interface ExchangeTestConnectionResponse {
  success: boolean;
  message: string;
  assets_found: number;
  total_value_usd: number | string;
}

interface WalletScanResult {
  wallet_id: string;
  tokens_found: number;
  total_value_usd: number | string;
  new_positions_detected: number;
  scan_time_ms: number;
}

interface ManualAssetCreateData {
  token: string;
  token_name: string;
  network: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  current_price?: number;
  type: string;
  staking_provider?: string;
  apy?: number;
  notes?: string;
}

interface AccountMembership {
  id: string;
  organization_id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: 'free' | 'pro' | 'enterprise';
  };
  role_id: string;
  role_name: string;
  status: string;
  client_access_mode: 'all' | 'specific';
  client_ids: string[];
  permissions: string[];
}

interface TeamRole {
  id: string;
  name: string;
  is_system: boolean;
  description: string | null;
  permissions: string[];
}

interface TeamMember {
  id: string;
  user_id: string;
  organization_id: string;
  role_id: string;
  role_name: string;
  status: 'active' | 'invited' | 'suspended';
  client_access_mode: 'all' | 'specific';
  client_ids: string[];
  invited_by_user_id: string | null;
  accepted_at: string | null;
  invited_at: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    is_active: boolean;
  };
}

interface TeamInvitation {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  role_name: string;
  team_id: string | null;
  team_name: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  invited_by_user_id: string | null;
  accepted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamInvitationAcceptResponse {
  user_id: string;
  membership_id: string;
  organization_id: string;
  status: string;
  created_user: boolean;
  requires_login: boolean;
}

interface AccountTeam {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  status: 'active' | 'archived';
  role_id: string | null;
  role_name: string | null;
  client_access_mode: 'all' | 'specific';
  client_ids: string[];
  member_count: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  is_active: boolean;
  user_count: number;
  client_count: number;
  team_count: number;
  created_at: string;
  updated_at: string;
}

interface AdminUserMembership {
  id: string;
  organization_id: string;
  organization_name: string;
  role_name: string;
  status: string;
  client_access_mode: string;
  team_count: number;
  team_names: string[];
}

interface AdminUser {
  id: string;
  organization_id: string | null;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  token_version: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  memberships: AdminUserMembership[];
}

interface AdminOverview {
  organization_count: number;
  active_organization_count: number;
  user_count: number;
  active_user_count: number;
  client_count: number;
  audit_event_count: number;
  bot_count: number;
  strategy_count: number;
  plan_count: number;
}

interface AdminPlanDefinition {
  plan: 'free' | 'pro' | 'enterprise';
  label: string;
  limits: Record<string, number | null>;
  features: string[];
}

interface AdminPlanUsage {
  organization_id: string;
  organization_name: string;
  plan: 'free' | 'pro' | 'enterprise';
  usage: Record<string, number>;
  limits: Record<string, number | null>;
  remaining: Record<string, number | null>;
  over_limit: Record<string, boolean>;
}

interface AdminFinanceSummary {
  subscription_count: number;
  active_subscription_count: number;
  past_due_subscription_count: number;
  open_invoice_count: number;
  overdue_invoice_count: number;
  mrr_cents: number;
  open_amount_cents: number;
  overdue_amount_cents: number;
  paid_amount_30d_cents: number;
  currency: string;
}

interface AdminBillingSubscription {
  id: string;
  organization_id: string;
  organization_name: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: string;
  provider: string;
  billing_email: string | null;
  currency: string;
  monthly_amount_cents: number;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminBillingInvoice {
  id: string;
  organization_id: string;
  organization_name: string;
  subscription_id: string | null;
  status: string;
  provider: string;
  number: string | null;
  currency: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  provider_invoice_id: string | null;
  hosted_invoice_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminBillingPayment {
  id: string;
  organization_id: string;
  organization_name: string;
  invoice_id: string | null;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  provider_payment_id: string | null;
  external_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BotTemplateParameter {
  id: string;
  template_id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  default_value: unknown | null;
  min_value: string | null;
  max_value: string | null;
  options: unknown[] | null;
  help_text: string | null;
  created_at: string;
  updated_at: string;
}

interface BotTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  status: string;
  required_plan: string;
  requires_trade_permission: boolean;
  supported_exchanges: string[];
  supported_assets: string[];
  default_parameters: Record<string, unknown>;
  risk_notes: string | null;
  strategy_id: string | null;
  strategy_name: string | null;
  parameter_count: number;
  active_instance_count: number;
  total_instance_count: number;
  parameters: BotTemplateParameter[];
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BotInstance {
  id: string;
  template_id: string | null;
  template_name: string | null;
  template_type: string | null;
  organization_id: string;
  organization_name: string | null;
  client_id: string;
  client_name: string;
  exchange_id: string | null;
  exchange_name: string | null;
  strategy_id: string | null;
  strategy_name: string | null;
  name: string;
  mode: string;
  status: string;
  live_enabled: boolean;
  parameters: Record<string, unknown>;
  risk_config: Record<string, unknown>;
  last_error: string | null;
  last_heartbeat_at: string | null;
  last_run_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  disabled_at: string | null;
  assets?: BotInstanceAsset[];
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BotInstanceAsset {
  id: string;
  organization_id: string;
  instance_id: string;
  symbol: string;
  source: string;
  bucket: string;
  playbook: string;
  status: string;
  approved_for_live: boolean;
  origin_rank: number | null;
  origin_timeframe: string | null;
  origin_direction: string | null;
  performance_percent: number | null;
  snapshot_id: string | null;
  last_backtest_run_id: string | null;
  last_backtest_score: number | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  ignored_at: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BotStrategy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  status: string;
  version: number;
  market_config: Record<string, unknown>;
  indicator_config: Record<string, unknown>;
  rule_config: Record<string, unknown>;
  risk_defaults: Record<string, unknown>;
  template_count: number;
  instance_count: number;
  backtest_count: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BotSchedulerStatus {
  enabled: boolean;
  interval_seconds: number;
  batch_limit: number;
  candle_limit: number;
  server_time: string;
  mode: string;
  message: string;
}

interface BotIndicator {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  status: string;
  parameter_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  default_parameters: Record<string, unknown>;
  supported_timeframes: string[];
  required_inputs: string[];
  engine_handler: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface BotRun {
  id: string;
  instance_id: string;
  organization_id: string;
  client_id: string;
  exchange_id: string | null;
  strategy_id: string | null;
  mode: string;
  status: string;
  cycle_key: string;
  input_snapshot: Record<string, unknown>;
  decision_snapshot: Record<string, unknown>;
  risk_snapshot: Record<string, unknown>;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BotRunBatch {
  instance_id: string;
  symbol_count: number;
  run_count: number;
  skipped_count: number;
  runs: BotRun[];
  skipped: Array<Record<string, unknown>>;
  basket: Record<string, unknown>;
}

interface BotBasketRefresh {
  instance: BotInstance;
  symbols: string[];
  symbol_count: number;
  basket: Record<string, unknown>;
}

interface BotSignal {
  id: string;
  instance_id: string;
  run_id: string | null;
  organization_id: string;
  client_id: string;
  exchange_id: string | null;
  strategy_id: string | null;
  action: string;
  status: string;
  symbol: string | null;
  confidence: number | null;
  price_usd: number | null;
  quantity: number | null;
  notional_usd: number | null;
  reason: string | null;
  input_snapshot: Record<string, unknown>;
  risk_snapshot: Record<string, unknown>;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

interface BotBacktest {
  id: string;
  strategy_id: string;
  template_id: string | null;
  organization_id: string | null;
  name: string;
  symbol: string;
  timeframe: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  initial_capital_usd: number;
  result_summary: Record<string, unknown>;
  metrics: Record<string, unknown>;
  logs: unknown[];
  error: string | null;
  created_by_user_id: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BotBacktestRun {
  id: string;
  organization_id: string;
  user_id: string | null;
  instance_id: string;
  strategy_id: string;
  strategy_version: number;
  client_id: string;
  exchange_id: string | null;
  symbol: string;
  exchange: string;
  market_type: string;
  timeframe: string;
  period_start: string;
  period_end: string;
  status: string;
  progress: number;
  initial_capital_usd: number;
  config_hash: string;
  config_snapshot: Record<string, unknown>;
  strategy_snapshot: Record<string, unknown>;
  risk_snapshot: Record<string, unknown>;
  cost_snapshot: Record<string, unknown>;
  data_quality: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  metrics: Record<string, unknown>;
  equity_curve: unknown[];
  drawdown_curve: unknown[];
  diagnostics: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BotBacktestTrade {
  id: string;
  run_id: string;
  organization_id: string;
  instance_id: string;
  symbol: string;
  side: string;
  entry_time: string;
  exit_time: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  gross_pnl: number;
  fee_paid: number;
  slippage_paid: number;
  net_pnl: number;
  return_percent: number;
  mae_percent: number;
  mfe_percent: number;
  entry_reason: string | null;
  exit_reason: string | null;
  bars_held: number;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BotBacktestCandle {
  open_time: string;
  close_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quote_volume: number;
}

interface BotBacktestIndicatorPoint {
  time: string;
  value: number;
}

interface BotBacktestIndicatorPayload {
  status?: string;
  label?: string;
  source?: string;
  parameters?: Record<string, unknown>;
  series?: Record<string, BotBacktestIndicatorPoint[]>;
}

interface BotBacktestChart {
  run_id: string;
  symbol: string;
  exchange: string;
  market_type: string;
  timeframe: string;
  period_start: string;
  period_end: string;
  candle_count_full: number;
  candle_count_loaded: number;
  candle_count_returned: number;
  trade_count_returned: number;
  trade_limit: number;
  candles: BotBacktestCandle[];
  trades: BotBacktestTrade[];
  indicators?: Record<string, BotBacktestIndicatorPayload>;
}

interface BotBacktestPreflight {
  symbol: string;
  exchange: string;
  market_type: string;
  timeframe: string;
  requested_period_start: string;
  requested_period_end: string;
  stored_rows: number;
  first_candle_at: string | null;
  last_candle_at: string | null;
  period_rows: number;
  period_first_candle_at: string | null;
  period_last_candle_at: string | null;
  expected_rows: number;
  coverage_percent: number;
  will_run_partial: boolean;
  message: string;
}

interface BotMarketRankingItem {
  id: string;
  rank: number;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  price: number;
  change_percent: number;
  volume: number;
  quote_volume: number;
  market_cap: number | null;
  candle_close_time: string | null;
  raw_payload: Record<string, unknown>;
}

interface BotMarketRanking {
  snapshot_id: string | null;
  source: string;
  exchange: string;
  market_type: string;
  timeframe: string;
  source_timeframe: string | null;
  direction: string;
  metric: string;
  top_n: number;
  generated_at: string | null;
  candle_time: string | null;
  metadata: Record<string, unknown>;
  items: BotMarketRankingItem[];
}

interface BotMarketScannerBootstrap {
  exchange: string;
  market_type: string;
  status: string;
  universe_count: number;
  candle_symbol_count: number;
  candles_stored: number;
  snapshots_generated: number;
  snapshot_item_count: number;
  reason: string | null;
  errors: string[];
}

interface BotMarketUniverseAsset {
  id: string;
  exchange: string;
  market_type: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  display_name: string | null;
  is_tradeable: boolean;
  status: string;
  last_price: number | null;
  quote_volume_24h: number;
  change_1h_percent: number | null;
  change_24h_percent: number | null;
  change_7d_percent: number | null;
  change_30d_percent: number | null;
  last_seen_at: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface AdminClient {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  email: string | null;
  color: string;
  wallet_count: number;
  active_wallet_count: number;
  exchange_count: number;
  active_exchange_count: number;
  sync_error_count: number;
  team_scope_count: number;
  membership_scope_count: number;
  last_wallet_scan_at: string | null;
  last_exchange_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminAuditLog {
  id: string;
  organization_id: string;
  organization_name: string | null;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

interface AdminBotMonitoringItem {
  organization_id: string;
  organization_name: string | null;
  client_id: string;
  client_name: string | null;
  instance_id: string;
  instance_name: string;
  instance_status: string;
  instance_mode: string;
  template_name: string | null;
  strategy_name: string | null;
  exchange_id: string | null;
  exchange_label: string | null;
  exchange_type: string | null;
  symbol: string;
  asset_status: string;
  approved_for_live: boolean;
  bucket: string;
  playbook: string;
  origin_direction: string | null;
  origin_timeframe: string | null;
  performance_percent: number | null;
  approved_at: string | null;
  last_run_id: string | null;
  last_run_status: string | null;
  last_run_cycle_key: string | null;
  last_run_started_at: string | null;
  last_run_completed_at: string | null;
  last_run_error: string | null;
  last_signal_id: string | null;
  last_signal_action: string | null;
  last_signal_status: string | null;
  last_signal_confidence: number | null;
  last_signal_price_usd: number | null;
  last_signal_notional_usd: number | null;
  last_signal_reason: string | null;
  last_signal_generated_at: string | null;
  candle_source: string | null;
  entry_passed: boolean | null;
  exit_passed: boolean | null;
  risk_blocks: string[];
  data_warnings: string[];
  active_stop_price: number | null;
  atr_stop: number | null;
  take_profit_price: number | null;
  trailing_stop_price: number | null;
  breakeven_price: number | null;
}

interface AdminBotMonitoringSummary {
  total_assets: number;
  live_monitoring_assets: number;
  approved_assets: number;
  candidate_assets: number;
  ignored_assets: number;
  disabled_assets: number;
  latest_buy_count: number;
  latest_sell_count: number;
  latest_hold_count: number;
  latest_failed_runs: number;
  data_warning_assets: number;
  risk_blocked_assets: number;
}

interface AdminBotMonitoring {
  summary: AdminBotMonitoringSummary;
  items: AdminBotMonitoringItem[];
}

interface AdminBotMonitoringHistoryItem {
  run_id: string | null;
  run_status: string | null;
  cycle_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  run_error: string | null;
  signal_id: string | null;
  signal_action: string | null;
  signal_status: string | null;
  confidence: number | null;
  price_usd: number | null;
  notional_usd: number | null;
  reason: string | null;
  generated_at: string | null;
  candle_source: string | null;
  entry_passed: boolean | null;
  exit_passed: boolean | null;
  risk_blocks: string[];
  data_warnings: string[];
}

interface AdminBotBacktestTradeItem {
  trade_id: string;
  run_id: string;
  organization_id: string;
  organization_name: string | null;
  client_id: string;
  client_name: string | null;
  instance_id: string;
  instance_name: string;
  template_name: string | null;
  strategy_name: string | null;
  exchange_id: string | null;
  exchange_label: string | null;
  exchange_type: string | null;
  symbol: string;
  side: string;
  timeframe: string;
  backtest_status: string;
  period_start: string;
  period_end: string;
  entry_time: string;
  exit_time: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  gross_pnl: number;
  fee_paid: number;
  slippage_paid: number;
  net_pnl: number;
  return_percent: number;
  mae_percent: number;
  mfe_percent: number;
  exit_reason: string | null;
  bars_held: number;
  created_at: string;
}

interface AdminBotPaperSignalItem {
  signal_id: string;
  run_id: string | null;
  organization_id: string;
  organization_name: string | null;
  client_id: string;
  client_name: string | null;
  instance_id: string;
  instance_name: string;
  template_name: string | null;
  strategy_name: string | null;
  exchange_id: string | null;
  exchange_label: string | null;
  exchange_type: string | null;
  symbol: string | null;
  action: string;
  status: string;
  confidence: number | null;
  price_usd: number | null;
  quantity: number | null;
  notional_usd: number | null;
  reason: string | null;
  candle_source: string | null;
  entry_passed: boolean | null;
  exit_passed: boolean | null;
  risk_blocks: string[];
  data_warnings: string[];
  generated_at: string;
}

interface BotLiveOrder {
  id: string;
  organization_id: string;
  organization_name: string | null;
  client_id: string;
  client_name: string | null;
  instance_id: string;
  instance_name: string;
  strategy_id: string | null;
  strategy_name: string | null;
  exchange_id: string | null;
  exchange_label: string | null;
  exchange_type: string | null;
  entry_signal_id: string | null;
  exit_signal_id: string | null;
  symbol: string;
  side: string;
  execution_mode: string;
  status: string;
  market_type: string;
  exchange_order_id: string | null;
  client_order_id: string | null;
  quantity: number | null;
  entry_price: number | null;
  exit_price: number | null;
  notional_usd: number | null;
  gross_pnl_usd: number | null;
  fee_usd: number | null;
  slippage_usd: number | null;
  net_pnl_usd: number | null;
  pnl_percent: number | null;
  stop_price: number | null;
  take_profit_price: number | null;
  trailing_stop_price: number | null;
  breakeven_price: number | null;
  opened_at: string | null;
  closed_at: string | null;
  last_reconciled_at: string | null;
  close_reason: string | null;
  error_message: string | null;
  risk_snapshot: Record<string, unknown>;
  order_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private activeAccountId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Try to get token from localStorage
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      this.activeAccountId = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    }
  }

  private isRefreshing = false;

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAutoRefresh = false
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (this.accessToken && this.activeAccountId) {
      (headers as Record<string, string>)['X-Account-Id'] = this.activeAccountId;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      // Auto-refresh on 401 (skip for auth endpoints to avoid loops)
      if (response.status === 401 && !skipAutoRefresh && !endpoint.includes('/auth/')) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          const refreshResult = await this.refreshToken();
          this.isRefreshing = false;

          if (refreshResult.success) {
            // Retry the original request with new token
            return this.request<T>(endpoint, options, true);
          }
        }
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: normalizeApiError(errorData, response.status),
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: normalizeApiError(errorData, response.status),
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // ========================
  // Auth methods
  // ========================

  async login(email: string, password: string): Promise<ApiResponse<TokenResponse>> {
    const result = await this.request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data) {
      this.accessToken = result.data.access_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', result.data.access_token);
        localStorage.setItem('refresh_token', result.data.refresh_token);
      }
    }

    return result;
  }

  async register(
    email: string,
    password: string,
    name: string,
    organizationName: string
  ): Promise<ApiResponse<TokenResponse>> {
    const result = await this.request<TokenResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name,
        organization_name: organizationName,
      }),
    });

    if (result.success && result.data) {
      this.accessToken = result.data.access_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', result.data.access_token);
        localStorage.setItem('refresh_token', result.data.refresh_token);
      }
    }

    return result;
  }

  async refreshToken(): Promise<ApiResponse<TokenResponse>> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (!refreshToken) {
      return { success: false, error: 'No refresh token' };
    }

    const result = await this.request<TokenResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (result.success && result.data) {
      this.accessToken = result.data.access_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', result.data.access_token);
        localStorage.setItem('refresh_token', result.data.refresh_token);
      }
    }

    return result;
  }

  async getMe(): Promise<ApiResponse<{
    id: string;
    email: string;
    name: string;
    role: string;
    organization_id: string | null;
    is_superuser: boolean;
    token_version: number;
  }>> {
    return this.request('/api/v1/auth/me');
  }

  async getMyMemberships(): Promise<ApiResponse<AccountMembership[]>> {
    return this.request<AccountMembership[]>('/api/v1/users/me/memberships');
  }

  logout() {
    this.accessToken = null;
    this.activeAccountId = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  setToken(token: string) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  setActiveAccountId(accountId: string | null) {
    this.activeAccountId = accountId;
    if (typeof window !== 'undefined') {
      if (accountId) {
        localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
      } else {
        localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      }
    }
  }

  getActiveAccountId(): string | null {
    if (this.activeAccountId) return this.activeAccountId;
    if (typeof window === 'undefined') return null;
    this.activeAccountId = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    return this.activeAccountId;
  }

  /**
   * Headers for raw fetch() calls that need to bypass the request() helper
   * (e.g., hooks that haven't been migrated yet). Always reads from
   * localStorage so it works after page reloads when this.accessToken
   * is still being initialized.
   */
  authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const token = this.accessToken
      || (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const activeAccountId = this.getActiveAccountId();
    if (token && activeAccountId) headers['X-Account-Id'] = activeAccountId;
    return headers;
  }

  // ========================
  // Team methods
  // ========================

  async getTeamRoles(): Promise<ApiResponse<TeamRole[]>> {
    return this.request<TeamRole[]>('/api/v1/team/roles');
  }

  async getTeamMembers(): Promise<ApiResponse<TeamMember[]>> {
    return this.request<TeamMember[]>('/api/v1/team/members');
  }

  async createTeamInvitation(data: {
    email: string;
    role_id: string;
    team_id?: string | null;
    notes?: string;
    expires_in_days?: number;
  }): Promise<ApiResponse<TeamInvitation>> {
    return this.request<TeamInvitation>('/api/v1/team/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async acceptTeamInvitation(
    token: string,
    data: { name?: string; password?: string } = {}
  ): Promise<ApiResponse<TeamInvitationAcceptResponse>> {
    return this.request<TeamInvitationAcceptResponse>(
      `/api/v1/team/invitations/${token}/accept`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async updateTeamMember(
    membershipId: string,
    data: { role_id?: string; status?: 'active' | 'invited' | 'suspended' }
  ): Promise<ApiResponse<TeamMember>> {
    return this.request<TeamMember>(`/api/v1/team/members/${membershipId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async revokeTeamMember(membershipId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/team/members/${membershipId}`, {
      method: 'DELETE',
    });
  }

  async updateTeamMemberScope(
    membershipId: string,
    data: { client_access_mode: 'all' | 'specific'; client_ids: string[] }
  ): Promise<ApiResponse<TeamMember>> {
    return this.request<TeamMember>(`/api/v1/team/members/${membershipId}/scope`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAccountTeams(): Promise<ApiResponse<AccountTeam[]>> {
    return this.request<AccountTeam[]>('/api/v1/team/teams');
  }

  async createAccountTeam(data: {
    name: string;
    description?: string;
    color?: string;
    role_id?: string | null;
    client_access_mode?: 'all' | 'specific';
    client_ids?: string[];
  }): Promise<ApiResponse<AccountTeam>> {
    return this.request<AccountTeam>('/api/v1/team/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountTeam(
    teamId: string,
    data: {
      name?: string;
      description?: string | null;
      color?: string;
      status?: 'active' | 'archived';
      role_id?: string | null;
      client_access_mode?: 'all' | 'specific';
      client_ids?: string[];
    }
  ): Promise<ApiResponse<AccountTeam>> {
    return this.request<AccountTeam>(`/api/v1/team/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async archiveAccountTeam(teamId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/team/teams/${teamId}`, {
      method: 'DELETE',
    });
  }

  async getAccountTeamMembers(teamId: string): Promise<ApiResponse<TeamMember[]>> {
    return this.request<TeamMember[]>(`/api/v1/team/teams/${teamId}/members`);
  }

  async addAccountTeamMember(
    teamId: string,
    membershipId: string
  ): Promise<ApiResponse<AccountTeam>> {
    return this.request<AccountTeam>(`/api/v1/team/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ membership_id: membershipId }),
    });
  }

  async removeAccountTeamMember(
    teamId: string,
    membershipId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(
      `/api/v1/team/teams/${teamId}/members/${membershipId}`,
      { method: 'DELETE' }
    );
  }

  // ========================
  // Platform admin methods
  // ========================

  async getAdminOverview(): Promise<ApiResponse<AdminOverview>> {
    return this.request<AdminOverview>('/api/v1/admin/overview');
  }

  async getAdminOrganizations(): Promise<ApiResponse<AdminOrganization[]>> {
    return this.request<AdminOrganization[]>('/api/v1/admin/organizations');
  }

  async getAdminPlans(): Promise<ApiResponse<AdminPlanDefinition[]>> {
    return this.request<AdminPlanDefinition[]>('/api/v1/admin/plans');
  }

  async getAdminPlanUsage(organizationId?: string): Promise<ApiResponse<AdminPlanUsage[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminPlanUsage[]>(`/api/v1/admin/plan-usage${qs}`);
  }

  async getAdminFinanceSummary(organizationId?: string): Promise<ApiResponse<AdminFinanceSummary>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminFinanceSummary>(`/api/v1/admin/finance/summary${qs}`);
  }

  async getAdminBillingSubscriptions(
    organizationId?: string
  ): Promise<ApiResponse<AdminBillingSubscription[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminBillingSubscription[]>(`/api/v1/admin/finance/subscriptions${qs}`);
  }

  async updateAdminBillingSubscription(
    organizationId: string,
    data: Partial<{
      plan: 'free' | 'pro' | 'enterprise';
      status: string;
      provider: string;
      billing_email: string | null;
      currency: string;
      monthly_amount_cents: number;
      current_period_start: string | null;
      current_period_end: string | null;
      trial_ends_at: string | null;
      cancel_at_period_end: boolean;
      provider_customer_id: string | null;
      provider_subscription_id: string | null;
      notes: string | null;
    }>
  ): Promise<ApiResponse<AdminBillingSubscription>> {
    return this.request<AdminBillingSubscription>(
      `/api/v1/admin/finance/subscriptions/${organizationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async getAdminBillingInvoices(organizationId?: string): Promise<ApiResponse<AdminBillingInvoice[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminBillingInvoice[]>(`/api/v1/admin/finance/invoices${qs}`);
  }

  async createAdminBillingInvoice(data: {
    organization_id: string;
    amount_due_cents: number;
    due_date?: string | null;
    issued_at?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    number?: string | null;
    notes?: string | null;
  }): Promise<ApiResponse<AdminBillingInvoice>> {
    return this.request<AdminBillingInvoice>('/api/v1/admin/finance/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminBillingInvoice(
    invoiceId: string,
    data: Partial<{
      status: string;
      number: string | null;
      amount_due_cents: number;
      issued_at: string | null;
      due_date: string | null;
      paid_at: string | null;
      period_start: string | null;
      period_end: string | null;
      provider_invoice_id: string | null;
      hosted_invoice_url: string | null;
      notes: string | null;
    }>
  ): Promise<ApiResponse<AdminBillingInvoice>> {
    return this.request<AdminBillingInvoice>(`/api/v1/admin/finance/invoices/${invoiceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminBillingPayments(organizationId?: string): Promise<ApiResponse<AdminBillingPayment[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminBillingPayment[]>(`/api/v1/admin/finance/payments${qs}`);
  }

  async createAdminBillingPayment(data: {
    organization_id?: string | null;
    invoice_id?: string | null;
    amount_cents: number;
    paid_at?: string | null;
    provider_payment_id?: string | null;
    external_reference?: string | null;
    notes?: string | null;
  }): Promise<ApiResponse<AdminBillingPayment>> {
    return this.request<AdminBillingPayment>('/api/v1/admin/finance/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminBillingPayment(
    paymentId: string,
    data: Partial<{
      status: string;
      amount_cents: number;
      paid_at: string | null;
      provider_payment_id: string | null;
      external_reference: string | null;
      notes: string | null;
    }>
  ): Promise<ApiResponse<AdminBillingPayment>> {
    return this.request<AdminBillingPayment>(`/api/v1/admin/finance/payments/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminBotTemplates(status?: string): Promise<ApiResponse<BotTemplate[]>> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<BotTemplate[]>(`/api/v1/admin/bots/templates${qs}`);
  }

  async getAdminBotStrategies(status?: string): Promise<ApiResponse<BotStrategy[]>> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<BotStrategy[]>(`/api/v1/admin/bots/strategies${qs}`);
  }

  async getAdminBotIndicators(category?: string): Promise<ApiResponse<BotIndicator[]>> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<BotIndicator[]>(`/api/v1/admin/bots/indicators${qs}`);
  }

  async createAdminBotStrategy(data: {
    name: string;
    slug: string;
    description?: string | null;
    type: string;
    status: string;
    market_config: Record<string, unknown>;
    indicator_config: Record<string, unknown>;
    rule_config: Record<string, unknown>;
    risk_defaults: Record<string, unknown>;
  }): Promise<ApiResponse<BotStrategy>> {
    return this.request<BotStrategy>('/api/v1/admin/bots/strategies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminBotStrategy(
    strategyId: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string | null;
      type: string;
      status: string;
      market_config: Record<string, unknown>;
      indicator_config: Record<string, unknown>;
      rule_config: Record<string, unknown>;
      risk_defaults: Record<string, unknown>;
    }>
  ): Promise<ApiResponse<BotStrategy>> {
    return this.request<BotStrategy>(`/api/v1/admin/bots/strategies/${strategyId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async runAdminBotBacktest(
    strategyId: string,
    data: {
      name?: string | null;
      symbol: string;
      timeframe?: string;
      initial_capital_usd?: number;
      period_start?: string | null;
      period_end?: string | null;
      risk_overrides?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<BotBacktest>> {
    return this.request<BotBacktest>(`/api/v1/admin/bots/strategies/${strategyId}/backtests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAdminBotBacktests(strategyId?: string): Promise<ApiResponse<BotBacktest[]>> {
    const qs = strategyId ? `?strategy_id=${encodeURIComponent(strategyId)}` : '';
    return this.request<BotBacktest[]>(`/api/v1/admin/bots/backtests${qs}`);
  }

  async createAdminBotTemplate(data: {
    name: string;
    slug: string;
    description?: string | null;
    type: string;
    status: string;
    required_plan: 'free' | 'pro' | 'enterprise';
    requires_trade_permission: boolean;
    supported_exchanges: string[];
    supported_assets: string[];
    default_parameters: Record<string, unknown>;
    risk_notes?: string | null;
    strategy_id?: string | null;
    parameters?: Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      default_value?: unknown | null;
      min_value?: string | null;
      max_value?: string | null;
      options?: unknown[] | null;
      help_text?: string | null;
    }>;
  }): Promise<ApiResponse<BotTemplate>> {
    return this.request<BotTemplate>('/api/v1/admin/bots/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminBotTemplate(
    templateId: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string | null;
      type: string;
      status: string;
      required_plan: 'free' | 'pro' | 'enterprise';
      requires_trade_permission: boolean;
      supported_exchanges: string[];
      supported_assets: string[];
      default_parameters: Record<string, unknown>;
      risk_notes: string | null;
      strategy_id: string | null;
      parameters: Array<{
        key: string;
        label: string;
        type: string;
        required: boolean;
        default_value?: unknown | null;
        min_value?: string | null;
        max_value?: string | null;
        options?: unknown[] | null;
        help_text?: string | null;
      }>;
    }>
  ): Promise<ApiResponse<BotTemplate>> {
    return this.request<BotTemplate>(`/api/v1/admin/bots/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminBotInstances(organizationId?: string): Promise<ApiResponse<BotInstance[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<BotInstance[]>(`/api/v1/admin/bots/instances${qs}`);
  }

  async getAdminBotMonitoring(params?: {
    organization_id?: string;
    client_id?: string;
    instance_id?: string;
    symbol?: string;
    asset_status?: string;
    bucket?: string;
    playbook?: string;
    signal_action?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AdminBotMonitoring>> {
    const search = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, String(value));
        }
      });
    }
    const qs = search.toString() ? `?${search.toString()}` : '';
    return this.request<AdminBotMonitoring>(`/api/v1/admin/bots/monitoring${qs}`);
  }

  async getAdminBotMonitoringHistory(
    instanceId: string,
    symbol: string,
    limit = 30
  ): Promise<ApiResponse<AdminBotMonitoringHistoryItem[]>> {
    return this.request<AdminBotMonitoringHistoryItem[]>(
      `/api/v1/admin/bots/monitoring/${instanceId}/${encodeURIComponent(symbol)}/history?limit=${limit}`
    );
  }

  async getAdminBotBacktestTrades(params?: {
    organization_id?: string;
    client_id?: string;
    instance_id?: string;
    symbol?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AdminBotBacktestTradeItem[]>> {
    const search = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, String(value));
        }
      });
    }
    const qs = search.toString() ? `?${search.toString()}` : '';
    return this.request<AdminBotBacktestTradeItem[]>(`/api/v1/admin/bots/trades/backtests${qs}`);
  }

  async getAdminBotPaperSignals(params?: {
    organization_id?: string;
    client_id?: string;
    instance_id?: string;
    symbol?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AdminBotPaperSignalItem[]>> {
    const search = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, String(value));
        }
      });
    }
    const qs = search.toString() ? `?${search.toString()}` : '';
    return this.request<AdminBotPaperSignalItem[]>(`/api/v1/admin/bots/trades/paper${qs}`);
  }

  async getAdminBotLiveOrders(
    kind: 'open' | 'closed',
    params?: {
      organization_id?: string;
      client_id?: string;
      instance_id?: string;
      symbol?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<BotLiveOrder[]>> {
    const search = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, String(value));
        }
      });
    }
    const qs = search.toString() ? `?${search.toString()}` : '';
    return this.request<BotLiveOrder[]>(`/api/v1/admin/bots/trades/live/${kind}${qs}`);
  }

  async generateAdminBotMarketRanking(data: {
    exchange: string;
    market_type?: string;
    timeframe: string;
    direction: string;
    top_n?: number;
    source_timeframe?: string | null;
    min_quote_volume?: number;
    min_price?: number | null;
    max_price?: number | null;
    quote_asset?: string | null;
    include_symbols?: string[];
    exclude_symbols?: string[];
    only_tradeable?: boolean;
  }): Promise<ApiResponse<BotMarketRanking>> {
    return this.request<BotMarketRanking>('/api/v1/admin/bots/market-rankings/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bootstrapAdminBotMarketScanner(data?: {
    exchange?: string;
    market_type?: string;
    quote_asset?: string;
    universe_limit?: number;
    candle_symbol_limit?: number;
    candle_timeframes?: string[];
    ranking_timeframes?: string[];
    directions?: string[];
    top_n?: number;
    min_quote_volume?: number;
    min_price?: number | null;
    max_price?: number | null;
  }): Promise<ApiResponse<BotMarketScannerBootstrap>> {
    return this.request<BotMarketScannerBootstrap>('/api/v1/admin/bots/market-scanner/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async updateAdminBotInstance(
    instanceId: string,
    data: Partial<{ status: string; last_error: string | null }>
  ): Promise<ApiResponse<BotInstance>> {
    return this.request<BotInstance>(`/api/v1/admin/bots/instances/${instanceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateAdminOrganization(
    organizationId: string,
    data: { plan?: 'free' | 'pro' | 'enterprise'; is_active?: boolean }
  ): Promise<ApiResponse<AdminOrganization>> {
    return this.request<AdminOrganization>(`/api/v1/admin/organizations/${organizationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminUsers(organizationId?: string): Promise<ApiResponse<AdminUser[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminUser[]>(`/api/v1/admin/users${qs}`);
  }

  async updateAdminUser(
    userId: string,
    data: { is_active?: boolean; is_superuser?: boolean }
  ): Promise<ApiResponse<AdminUser>> {
    return this.request<AdminUser>(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminClients(organizationId?: string): Promise<ApiResponse<AdminClient[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminClient[]>(`/api/v1/admin/clients${qs}`);
  }

  async getAdminAuditLogs(organizationId?: string): Promise<ApiResponse<AdminAuditLog[]>> {
    const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
    return this.request<AdminAuditLog[]>(`/api/v1/admin/audit-logs${qs}`);
  }

  async getBotTemplates(): Promise<ApiResponse<BotTemplate[]>> {
    return this.request<BotTemplate[]>('/api/v1/bots/templates');
  }

  async getBotStrategies(): Promise<ApiResponse<BotStrategy[]>> {
    return this.request<BotStrategy[]>('/api/v1/bots/strategies');
  }

  async getBotIndicators(): Promise<ApiResponse<BotIndicator[]>> {
    return this.request<BotIndicator[]>('/api/v1/bots/indicators');
  }

  async getBotInstances(): Promise<ApiResponse<BotInstance[]>> {
    return this.request<BotInstance[]>('/api/v1/bots/instances');
  }

  async getBotMarketRanking(params?: {
    exchange?: string;
    market_type?: string;
    timeframe?: string;
    direction?: string;
    top_n?: number;
    min_quote_volume?: number;
    min_price?: number;
    max_price?: number;
    quote_asset?: string;
  }): Promise<ApiResponse<BotMarketRanking>> {
    const query = new URLSearchParams();
    if (params?.exchange) query.set('exchange', params.exchange);
    if (params?.market_type) query.set('market_type', params.market_type);
    if (params?.timeframe) query.set('timeframe', params.timeframe);
    if (params?.direction) query.set('direction', params.direction);
    if (params?.top_n) query.set('top_n', String(params.top_n));
    if (params?.min_quote_volume !== undefined) query.set('min_quote_volume', String(params.min_quote_volume));
    if (params?.min_price !== undefined) query.set('min_price', String(params.min_price));
    if (params?.max_price !== undefined) query.set('max_price', String(params.max_price));
    if (params?.quote_asset) query.set('quote_asset', params.quote_asset);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<BotMarketRanking>(`/api/v1/bots/market-rankings${qs}`);
  }

  async getBotMarketUniverse(params?: {
    exchange?: string;
    market_type?: string;
    quote_asset?: string;
    only_tradeable?: boolean;
    limit?: number;
  }): Promise<ApiResponse<BotMarketUniverseAsset[]>> {
    const query = new URLSearchParams();
    if (params?.exchange) query.set('exchange', params.exchange);
    if (params?.market_type) query.set('market_type', params.market_type);
    if (params?.quote_asset) query.set('quote_asset', params.quote_asset);
    if (params?.only_tradeable !== undefined) query.set('only_tradeable', String(params.only_tradeable));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<BotMarketUniverseAsset[]>(`/api/v1/bots/market-universe${qs}`);
  }

  async createBotInstance(data: {
    template_id: string;
    client_id: string;
    exchange_id?: string | null;
    strategy_id?: string | null;
    name?: string | null;
    mode: 'paper' | 'live';
    parameters?: Record<string, unknown>;
    risk_config?: Record<string, unknown>;
  }): Promise<ApiResponse<BotInstance>> {
    return this.request<BotInstance>('/api/v1/bots/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBotInstance(
    instanceId: string,
    data: Partial<{
      name: string;
      client_id: string;
      exchange_id: string | null;
      strategy_id: string | null;
      mode: 'paper' | 'live';
      status: string;
      parameters: Record<string, unknown>;
      risk_config: Record<string, unknown>;
    }>
  ): Promise<ApiResponse<BotInstance>> {
    return this.request<BotInstance>(`/api/v1/bots/instances/${instanceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async runBotInstancePaper(
    instanceId: string,
    cycleKey?: string,
    options?: { symbol?: string; timeframe?: string }
  ): Promise<ApiResponse<BotRun>> {
    return this.request<BotRun>(`/api/v1/bots/instances/${instanceId}/run-paper`, {
      method: 'POST',
      body: JSON.stringify({
        cycle_key: cycleKey || null,
        symbol: options?.symbol || null,
        timeframe: options?.timeframe || null,
      }),
    });
  }

  async runBotInstancePaperBasket(
    instanceId: string,
    options?: { symbol?: string; timeframe?: string }
  ): Promise<ApiResponse<BotRunBatch>> {
    return this.request<BotRunBatch>(`/api/v1/bots/instances/${instanceId}/run-paper-basket`, {
      method: 'POST',
      body: JSON.stringify({
        cycle_key: null,
        symbol: options?.symbol || null,
        timeframe: options?.timeframe || null,
      }),
    });
  }

  async refreshBotInstanceBasket(instanceId: string): Promise<ApiResponse<BotBasketRefresh>> {
    return this.request<BotBasketRefresh>(`/api/v1/bots/instances/${instanceId}/basket/refresh`, {
      method: 'POST',
    });
  }

  async updateBotInstanceAsset(
    instanceId: string,
    symbol: string,
    data: Partial<{
      status: string;
      playbook: string;
      bucket: string;
      approved_for_live: boolean;
    }>
  ): Promise<ApiResponse<BotInstance>> {
    return this.request<BotInstance>(
      `/api/v1/bots/instances/${instanceId}/assets/${encodeURIComponent(symbol)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async getBotInstanceRuns(instanceId: string): Promise<ApiResponse<BotRun[]>> {
    return this.request<BotRun[]>(`/api/v1/bots/instances/${instanceId}/runs`);
  }

  async getBotInstanceSignals(instanceId: string, limit?: number): Promise<ApiResponse<BotSignal[]>> {
    const qs = limit ? `?limit=${encodeURIComponent(String(limit))}` : '';
    return this.request<BotSignal[]>(`/api/v1/bots/instances/${instanceId}/signals${qs}`);
  }

  async getBotSchedulerStatus(): Promise<ApiResponse<BotSchedulerStatus>> {
    return this.request<BotSchedulerStatus>('/api/v1/bots/scheduler/status');
  }

  async preflightBotInstanceBacktest(
    instanceId: string,
    data: {
      symbol: string;
      timeframe?: string;
      initial_capital_usd?: number;
      period_start?: string | null;
      period_end?: string | null;
      fee_percent?: number;
      slippage_percent?: number;
      risk_overrides?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<BotBacktestPreflight>> {
    return this.request<BotBacktestPreflight>(`/api/v1/bots/instances/${instanceId}/backtests/preflight`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createBotInstanceBacktest(
    instanceId: string,
    data: {
      symbol: string;
      timeframe?: string;
      initial_capital_usd?: number;
      period_start?: string | null;
      period_end?: string | null;
      fee_percent?: number;
      slippage_percent?: number;
      risk_overrides?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<BotBacktestRun>> {
    return this.request<BotBacktestRun>(`/api/v1/bots/instances/${instanceId}/backtests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBotBacktestRun(runId: string): Promise<ApiResponse<BotBacktestRun>> {
    return this.request<BotBacktestRun>(`/api/v1/bots/backtests/${runId}`);
  }

  async getBotBacktestTrades(runId: string): Promise<ApiResponse<BotBacktestTrade[]>> {
    return this.request<BotBacktestTrade[]>(`/api/v1/bots/backtests/${runId}/trades`);
  }

  async getBotBacktestChart(runId: string, timeframe?: string): Promise<ApiResponse<BotBacktestChart>> {
    const query = timeframe ? `?timeframe=${encodeURIComponent(timeframe)}` : '';
    return this.request<BotBacktestChart>(`/api/v1/bots/backtests/${runId}/chart${query}`);
  }

  async requestBotLiveEnable(
    instanceId: string,
    data: { confirm_risk: boolean; reason?: string | null }
  ): Promise<ApiResponse<BotInstance>> {
    return this.request<BotInstance>(`/api/v1/bots/instances/${instanceId}/live/enable`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========================
  // Client methods
  // ========================

  /** Get clients list with real portfolio summaries */
  async getClients(): Promise<ApiResponse<ClientListItem[]>> {
    return this.request<ClientListItem[]>('/api/v1/clients');
  }

  /** Create a new client */
  async createClient(name: string, email?: string, notes?: string, color?: string): Promise<ApiResponse<ClientData>> {
    return this.request<ClientData>('/api/v1/clients', {
      method: 'POST',
      body: JSON.stringify({ name, email, notes, color }),
    });
  }

  /** Update a client */
  async updateClient(clientId: string, data: { name?: string; email?: string; notes?: string; color?: string }): Promise<ApiResponse<ClientData>> {
    return this.request<ClientData>(`/api/v1/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /** Delete a client */
  async deleteClient(clientId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/clients/${clientId}`, {
      method: 'DELETE',
    });
  }

  /** Get complete client portfolio */
  async getClientPortfolio(clientId: string): Promise<ApiResponse<ClientPortfolioData>> {
    return this.request<ClientPortfolioData>(`/api/v1/clients/${clientId}/portfolio`);
  }

  /** Get manual observation rows for a client */
  async getClientObservations(clientId: string): Promise<ApiResponse<ClientObservation[]>> {
    return this.request<ClientObservation[]>(`/api/v1/clients/${clientId}/observations`);
  }

  /** Create a manual observation row for a client */
  async createClientObservation(
    clientId: string,
    data: ClientObservationCreateData
  ): Promise<ApiResponse<ClientObservation>> {
    return this.request<ClientObservation>(`/api/v1/clients/${clientId}/observations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========================
  // Wallet methods
  // ========================

  async getWallets(clientId: string): Promise<ApiResponse<WalletData[]>> {
    return this.request<WalletData[]>(`/api/v1/clients/${clientId}/wallets`);
  }

  async createWallet(
    clientId: string,
    address: string,
    chain: string,
    label: string,
    network: 'evm' | 'solana' | 'bitcoin' = 'evm'
  ): Promise<ApiResponse<WalletData>> {
    return this.request<WalletData>(`/api/v1/clients/${clientId}/wallets`, {
      method: 'POST',
      body: JSON.stringify({ address, chain, label, network }),
    });
  }

  async deleteWallet(clientId: string, walletId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/clients/${clientId}/wallets/${walletId}`, {
      method: 'DELETE',
    });
  }

  /** Scan wallet for tokens via Zerion */
  async scanWallet(clientId: string, walletId: string): Promise<ApiResponse<WalletScanResult>> {
    return this.request<WalletScanResult>(`/api/v1/clients/${clientId}/wallets/${walletId}/scan`, {
      method: 'POST',
    });
  }

  // ========================
  // Exchange methods (client-scoped)
  // ========================

  /** Add an exchange to a client */
  async createClientExchange(clientId: string, data: ExchangeCreateData): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/v1/clients/${clientId}/exchanges`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Update editable exchange metadata */
  async updateClientExchange(clientId: string, exchangeId: string, data: ExchangeUpdateData): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/v1/clients/${clientId}/exchanges/${exchangeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /** Delete an exchange from a client */
  async deleteClientExchange(clientId: string, exchangeId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/clients/${clientId}/exchanges/${exchangeId}`, {
      method: 'DELETE',
    });
  }

  /** Sync exchange data */
  async syncClientExchange(clientId: string, exchangeId: string): Promise<ApiResponse<ExchangeSyncResult>> {
    return this.request<ExchangeSyncResult>(`/api/v1/clients/${clientId}/exchanges/${exchangeId}/sync`, {
      method: 'POST',
    });
  }

  /** Test exchange connection before saving */
  async testExchangeConnection(data: { exchange: string; api_key: string; api_secret: string }): Promise<ApiResponse<ExchangeTestConnectionResponse>> {
    return this.request<ExchangeTestConnectionResponse>('/api/v1/exchanges/test-connection', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========================
  // Manual Asset methods
  // ========================

  /** Add a manual asset to a client */
  async createManualAsset(clientId: string, data: ManualAssetCreateData): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/v1/clients/${clientId}/manual-assets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Update a manual asset */
  async updateManualAsset(clientId: string, assetId: string, data: Partial<ManualAssetCreateData>): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/v1/clients/${clientId}/manual-assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /** Delete a manual asset */
  async deleteManualAsset(clientId: string, assetId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/clients/${clientId}/manual-assets/${assetId}`, {
      method: 'DELETE',
    });
  }

  // ========================
  // Pool position baselines (LP IL/HODL fallback)
  // ========================

  async getPoolBaselines(walletAddress?: string): Promise<ApiResponse<PoolBaselineListResponse>> {
    const qs = walletAddress ? `?wallet_address=${encodeURIComponent(walletAddress)}` : '';
    return this.request<PoolBaselineListResponse>(`/api/v1/pool-baselines${qs}`);
  }

  async upsertPoolBaseline(payload: PoolBaselineUpsert): Promise<ApiResponse<PoolBaseline>> {
    return this.request<PoolBaseline>('/api/v1/pool-baselines', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ========================
  // Health check
  // ========================

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>('/health');
  }
}

// ========================
// Pool baseline types
// ========================

export type PoolBaselineSource = 'subgraph_history' | 'first_observed' | 'manual';

export interface PoolBaseline {
  id: string;
  organization_id: string;
  wallet_address: string;
  position_key: string;
  protocol: string;
  chain: string;
  token0_symbol: string;
  token1_symbol: string;
  token0_amount: string;
  token1_amount: string;
  token0_price_usd: string;
  token1_price_usd: string;
  baseline_value_usd: string;
  baseline_at: string;
  source: PoolBaselineSource;
  resnapshot_count: number;
  created_at: string;
  updated_at: string;
}

export interface PoolBaselineListResponse {
  items: PoolBaseline[];
  count: number;
}

export interface PoolBaselineUpsert {
  wallet_address: string;
  position_key: string;
  protocol: string;
  chain: string;
  token0_symbol: string;
  token1_symbol: string;
  token0_amount: string | number;
  token1_amount: string | number;
  token0_price_usd: string | number;
  token1_price_usd: string | number;
  baseline_value_usd: string | number;
  baseline_at: string; // ISO 8601
  source: PoolBaselineSource;
}

// Singleton instance
export const api = new ApiClient(API_URL);

export type {
  ApiResponse,
  TokenResponse,
  WalletData,
  ClientData,
  ClientListItem,
  ClientObservation,
  ClientObservationCreateData,
  ClientPortfolioData,
  ExchangeCreateData,
  ExchangeSyncResult,
  ExchangeTestConnectionResponse,
  WalletScanResult,
  ManualAssetCreateData,
  AccountMembership,
  AccountTeam,
  TeamRole,
  TeamMember,
  TeamInvitation,
  TeamInvitationAcceptResponse,
  AdminOrganization,
  AdminUser,
  AdminOverview,
  AdminPlanDefinition,
  AdminPlanUsage,
  AdminFinanceSummary,
  AdminBillingSubscription,
  AdminBillingInvoice,
  AdminBillingPayment,
  AdminBotMonitoring,
  AdminBotBacktestTradeItem,
  AdminBotMonitoringHistoryItem,
  AdminBotMonitoringItem,
  AdminBotMonitoringSummary,
  AdminBotPaperSignalItem,
  BotLiveOrder,
  BotTemplate,
  BotInstance,
  BotInstanceAsset,
  BotSchedulerStatus,
  BotStrategy,
  BotIndicator,
  BotRun,
  BotRunBatch,
  BotBasketRefresh,
  BotSignal,
  BotBacktest,
  BotBacktestRun,
  BotBacktestTrade,
  BotBacktestCandle,
  BotBacktestChart,
  BotBacktestPreflight,
  BotMarketRanking,
  BotMarketRankingItem,
  BotMarketScannerBootstrap,
  BotMarketUniverseAsset,
  AdminClient,
  AdminAuditLog,
};
