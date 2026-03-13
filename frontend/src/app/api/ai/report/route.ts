import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_SYSTEM_PROMPT } from '@/lib/ai/ai-constants';

export async function POST(request: NextRequest) {
  try {
    const { context } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 401 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: AI_SYSTEM_PROMPT,
    });

    // Build detailed context for the AI
    const topPositionsText = (context.topPositions || [])
      .map((p: { symbol?: string; value?: number; percentage?: number; chain?: string; type?: string }) =>
        `  - ${p.symbol || 'N/A'}: $${(p.value || 0).toLocaleString()} (${(p.percentage || 0).toFixed(1)}%) [${p.chain || 'N/A'} / ${p.type || 'N/A'}]`
      ).join('\n');

    const distributionByTypeText = (context.distributionByType || [])
      .map((d: { type?: string; value?: number; percentage?: number }) =>
        `  - ${d.type || 'N/A'}: $${(d.value || 0).toLocaleString()} (${(d.percentage || 0).toFixed(1)}%)`
      ).join('\n');

    const distributionByChainText = (context.distributionByChain || [])
      .map((d: { chain?: string; value?: number; percentage?: number }) =>
        `  - ${d.chain || 'N/A'}: $${(d.value || 0).toLocaleString()} (${(d.percentage || 0).toFixed(1)}%)`
      ).join('\n');

    const prompt = `
Gere um relatório profissional e detalhado de análise de portfólio cripto no formato abaixo.

DADOS DO PORTFÓLIO:

Total AUM: $${context.summary?.totalValue?.toLocaleString() || '0'}
Posições Ativas: ${context.summary?.totalPositionCount || 0}
Data de Referência: ${new Date().toLocaleDateString('pt-BR')}

MÉTRICAS DE RISCO:
- VaR 95% (diário): ${context.riskMetrics?.var95 != null ? context.riskMetrics.var95.toFixed(2) + '%' : 'N/A'}
- CVaR 95%: ${context.riskMetrics?.cvar95 != null ? context.riskMetrics.cvar95.toFixed(2) + '%' : 'N/A'}
- Sharpe Ratio: ${context.riskMetrics?.sharpeRatio != null ? context.riskMetrics.sharpeRatio.toFixed(2) : 'N/A'}
- Max Drawdown: ${context.riskMetrics?.maxDrawdown != null ? context.riskMetrics.maxDrawdown.toFixed(2) + '%' : 'N/A'}
- Volatilidade 30d: ${context.riskMetrics?.volatility30d != null ? context.riskMetrics.volatility30d.toFixed(2) + '%' : 'N/A'}
- Leverage Ratio: ${context.riskMetrics?.leverageRatio?.gross != null ? context.riskMetrics.leverageRatio.gross.toFixed(1) + 'x' : 'N/A'}
- Concentração (top asset): ${context.riskMetrics?.concentrationRisk?.topAssetPercent != null ? context.riskMetrics.concentrationRisk.topAssetPercent.toFixed(1) + '% (' + (context.riskMetrics.concentrationRisk.topAssetSymbol || '') + ')' : 'N/A'}

Score de Risco: ${context.riskScore?.score || 'N/A'}/100 - Status: ${context.riskScore?.status || 'N/A'}

TOP POSIÇÕES:
${topPositionsText || '  Nenhuma posição disponível'}

DISTRIBUIÇÃO POR TIPO:
${distributionByTypeText || '  Sem dados'}

DISTRIBUIÇÃO POR CHAIN:
${distributionByChainText || '  Sem dados'}

INSTRUÇÕES DE FORMATAÇÃO:
Use EXATAMENTE esta estrutura com numeração. Use markdown para formatação:

# RELATÓRIO DE ANÁLISE DE PORTFÓLIO CRIPTO

## 1. RESUMO EXECUTIVO
(Visão geral do portfólio, status atual, pontos de atenção. 2-3 parágrafos concisos.)

## 2. ANÁLISE DE RISCO
### 2.1 Métricas de Risco
(Tabela em markdown com: Métrica | Valor | Benchmark Institucional | Status)

### 2.2 Interpretação
(Análise detalhada de cada métrica, com comparação a benchmarks. Use bullet points.)

## 3. DISTRIBUIÇÃO DE ATIVOS
### 3.1 Alocação Atual
(Análise da distribuição por tipo e por chain. Use tabelas markdown.)

### 3.2 Diversificação
(Avaliação do nível de diversificação. Risco de concentração.)

## 4. PERFORMANCE
(Análise da relação risco-retorno. Sharpe ratio, drawdown, volatilidade.)

## 5. EXPOSIÇÃO DeFi
(Análise dos protocolos DeFi, riscos específicos, considerações.)

## 6. RECOMENDAÇÕES ESTRATÉGICAS
(3-5 recomendações numeradas, cada uma com: ação específica, justificativa, prioridade [Alta/Média/Baixa])

Seja preciso, profissional e use os dados reais fornecidos. Formate tabelas corretamente em markdown.
`;

    const result = await model.generateContent(prompt);
    const reportContent = result.response.text();

    return NextResponse.json({
      content: reportContent,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAum: context.summary?.totalValue || 0,
        positionCount: context.summary?.totalPositionCount || 0,
        riskStatus: context.riskScore?.status || 'unknown',
        riskScoreValue: context.riskScore?.score || 0,
      },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
