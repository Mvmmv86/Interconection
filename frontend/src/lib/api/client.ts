/**
 * API Client for backend communication
 */

// Use relative paths — Next.js proxy rewrites /api/* to backend
const API_URL = '';

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

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Try to get token from localStorage
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
    }
  }

  private isRefreshing = false;

  private async request<T>(
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

  async getMe(): Promise<ApiResponse<{ id: string; email: string; name: string; role: string; organization_id: string }>> {
    return this.request('/api/v1/auth/me');
  }

  logout() {
    this.accessToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
  // Health check
  // ========================

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>('/health');
  }
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
};
