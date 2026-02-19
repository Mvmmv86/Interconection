/**
 * Tipos e constantes para o sistema de Risk Management
 * Baseado em padrões institucionais de hedge funds crypto
 */

export interface RiskMetrics {
  var95: number;           // VaR 95% diário em %
  cvar95: number;          // CVaR / Expected Shortfall em %
  maxDrawdown: number;     // Max drawdown em %
  volatility30d: number;   // Volatilidade anualizada em %
  sharpeRatio: number;     // Sharpe Ratio anualizado
  leverageRatio: {
    gross: number;         // (long + |short|) / equity
    net: number;           // (long - |short|) / equity
    futuresNotional: number;
    totalEquity: number;
  };
  concentrationRisk: {
    topAssetPercent: number;  // % do maior ativo
    topAssetSymbol: string;
    hhi: number;              // Herfindahl-Hirschman Index (0-10000)
    top3Percent: number;      // % dos 3 maiores ativos
  };
  correlationMatrix: {
    assets: string[];
    matrix: number[][];
  };
}

export interface RiskThresholds {
  var95: { warning: number; danger: number };
  cvar95: { warning: number; danger: number };
  maxDrawdown: { warning: number; danger: number };
  leverageRatio: { warning: number; danger: number };
  concentration: { warning: number; danger: number };
  sharpeRatio: { warning: number; danger: number };
}

export interface RiskAlert {
  id: string;
  metric: string;
  severity: 'warning' | 'danger';
  message: string;
  value: number;
  threshold: number;
}

export type RiskStatus = 'healthy' | 'warning' | 'danger';

export interface RiskScore {
  score: number;        // 0-100 (100 = sem risco, 0 = risco máximo)
  status: RiskStatus;
  alerts: RiskAlert[];
}

// Thresholds padrão baseados em hedge funds crypto institucionais
// Fontes: Kaiko, XBTO, GARP, Morgan Stanley
export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  var95:         { warning: 3,   danger: 5 },    // VaR 95% diário
  cvar95:        { warning: 5,   danger: 8 },    // CVaR / Expected Shortfall
  maxDrawdown:   { warning: 15,  danger: 25 },   // Max drawdown do pico
  leverageRatio: { warning: 2,   danger: 3 },    // Leverage bruto
  concentration: { warning: 25,  danger: 40 },   // % single asset
  sharpeRatio:   { warning: 1.0, danger: 0.5 },  // Invertido: abaixo é ruim
};

// Ranges dos sliders no modal de configurações
export const THRESHOLD_RANGES: Record<keyof RiskThresholds, { min: number; max: number; step: number; unit: string; inverted?: boolean }> = {
  var95:         { min: 1,  max: 10, step: 0.5, unit: '%' },
  cvar95:        { min: 2,  max: 15, step: 0.5, unit: '%' },
  maxDrawdown:   { min: 5,  max: 50, step: 1,   unit: '%' },
  leverageRatio: { min: 1,  max: 5,  step: 0.5, unit: 'x' },
  concentration: { min: 10, max: 60, step: 5,   unit: '%' },
  sharpeRatio:   { min: 0,  max: 3,  step: 0.1, unit: '', inverted: true },
};

// Labels legíveis para cada métrica
export const METRIC_LABELS: Record<keyof RiskThresholds, { name: string; description: string }> = {
  var95:         { name: 'VaR 95% (Diário)', description: 'Perda máxima esperada em 1 dia com 95% de confiança' },
  cvar95:        { name: 'CVaR / Expected Shortfall', description: 'Média das perdas além do VaR (risco de cauda)' },
  maxDrawdown:   { name: 'Max Drawdown', description: 'Queda máxima desde o pico histórico' },
  leverageRatio: { name: 'Leverage Ratio', description: 'Exposição total dividida pelo patrimônio' },
  concentration: { name: 'Concentração (Single Asset)', description: 'Percentual do maior ativo no portfólio' },
  sharpeRatio:   { name: 'Sharpe Ratio', description: 'Retorno ajustado ao risco (maior = melhor)' },
};

// Mapeamento símbolo → CoinGecko ID (para o hook)
export const SYMBOL_TO_COINGECKO: Record<string, string> = {
  'BTC': 'bitcoin', 'WBTC': 'wrapped-bitcoin', 'ETH': 'ethereum',
  'WETH': 'weth', 'SOL': 'solana', 'USDT': 'tether', 'USDC': 'usd-coin',
  'BNB': 'binancecoin', 'XRP': 'ripple', 'ADA': 'cardano',
  'AVAX': 'avalanche-2', 'DOT': 'polkadot', 'MATIC': 'matic-network',
  'POL': 'matic-network', 'LINK': 'chainlink', 'UNI': 'uniswap',
  'AAVE': 'aave', 'ARB': 'arbitrum', 'OP': 'optimism',
  'DOGE': 'dogecoin', 'SHIB': 'shiba-inu', 'ATOM': 'cosmos',
  'NEAR': 'near', 'FTM': 'fantom', 'ALGO': 'algorand',
  'CRV': 'curve-dao-token', 'MKR': 'maker', 'SNX': 'havven',
  'COMP': 'compound-governance-token', 'SUSHI': 'sushi',
  'JUP': 'jupiter-exchange-solana', 'RAY': 'raydium',
  'ORCA': 'orca', 'BONK': 'bonk', 'WIF': 'dogwifcoin',
  'LDO': 'lido-dao', 'PEPE': 'pepe', 'SUI': 'sui',
  'APT': 'aptos', 'STX': 'blockstack', 'GRT': 'the-graph',
};

// localStorage key para thresholds customizados
export const RISK_THRESHOLDS_STORAGE_KEY = 'interconection-risk-thresholds';
