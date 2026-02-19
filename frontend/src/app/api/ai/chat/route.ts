import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_SYSTEM_PROMPT } from '@/lib/ai/ai-constants';
import type { PortfolioContext } from '@/types/ai';

export const runtime = 'edge';

interface MessageInput {
  role: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json() as { messages: MessageInput[]; context: PortfolioContext };

    // Get API key from environment (user can configure their own later)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response('API key not configured', { status: 401 });
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

    const anthropic = new Anthropic({ apiKey });

    // Stream response
    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: AI_SYSTEM_PROMPT + '\n\n' + contextMessage,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      stream: true,
    });

    // Convert to ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
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
