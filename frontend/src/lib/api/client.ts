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
          error: errorData.message || errorData.detail || `HTTP ${response.status}`,
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || errorData.detail || `HTTP ${response.status}`,
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
  AdminClient,
  AdminAuditLog,
};
