import type { UnifiedPosition, PositionsSummary, DistributionByType, DistributionByChain } from './positions';
import type { RiskMetrics } from '@/lib/risk/risk-types';

export interface AIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string; // Mascarado (apenas últimos 4 chars visíveis)
  isConfigured: boolean;
}

export interface AIReport {
  id: string;
  title: string;
  generatedAt: Date;
  portfolioSnapshot: Record<string, unknown>;
}

export interface PortfolioContext {
  summary: PositionsSummary;
  topPositions: UnifiedPosition[];
  riskMetrics: RiskMetrics | null;
  distributionByType: DistributionByType[];
  distributionByChain: DistributionByChain[];
  totalValue: number;
  positionCount: number;
}
