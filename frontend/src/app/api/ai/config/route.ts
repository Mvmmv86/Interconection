import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json();

    // Test API key
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
    } else if (provider === 'openai') {
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model: 'gpt-4',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 400 }
    );
  }
}

export async function GET() {
  const hasDefault = !!process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({ hasDefaultKey: hasDefault });
}
