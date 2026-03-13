import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_SYSTEM_PROMPT } from '@/lib/ai/ai-constants';
import type { PortfolioContext } from '@/types/ai';

interface MessageInput {
  role: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json() as { messages: MessageInput[]; context: PortfolioContext };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response('Gemini API key not configured', { status: 401 });
    }

    // Format context as part of system instruction
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: AI_SYSTEM_PROMPT + '\n\n' + contextMessage,
    });

    // Convert messages to Gemini format (history + last user message)
    const geminiHistory = messages.slice(0, -1).map((m: MessageInput) => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({ history: geminiHistory });
    const streamResult = await chat.sendMessageStream(lastMessage.content);

    // Convert to ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of streamResult.stream) {
          const text = chunk.text();
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
