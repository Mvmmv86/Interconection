import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { AI_SYSTEM_PROMPT } from '@/lib/ai/ai-constants';
import type { PortfolioContext } from '@/types/ai';

interface MessageInput {
  role: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json() as { messages: MessageInput[]; context: PortfolioContext };

    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      return new Response('GLM API key not configured', { status: 401 });
    }

    // Format context as system message
    const contextMessage = `
Portfolio Context (dados reais do usuário):
- Total AUM: $${context.totalValue?.toLocaleString() || '0'}
- Posições ativas: ${context.positionCount || 0}
- Top Holdings: ${context.topPositions?.map((p) => `${p.symbol} ($${p.value?.toFixed(0) || '0'})`).join(', ') || 'N/A'}
- VaR (95%): ${context.riskMetrics?.var95?.toFixed(2) || 'N/A'}%
- CVaR (95%): ${context.riskMetrics?.cvar95?.toFixed(2) || 'N/A'}%
- Sharpe Ratio: ${context.riskMetrics?.sharpeRatio?.toFixed(2) || 'N/A'}
- Max Drawdown: ${context.riskMetrics?.maxDrawdown?.toFixed(2) || 'N/A'}%
- Concentração: ${context.riskMetrics?.concentrationRisk?.topAssetPercent?.toFixed(1) || 'N/A'}% em ${context.riskMetrics?.concentrationRisk?.topAssetSymbol || 'N/A'}
`;

    const openai = new OpenAI({
      apiKey,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    });

    const stream = await openai.chat.completions.create({
      model: 'GLM-4.7-Flash',
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT + '\n\n' + contextMessage },
        ...messages.map((m: MessageInput) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    });

    // Convert to ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(message, { status: 500 });
  }
}
