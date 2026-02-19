import { NextResponse } from 'next/server';

const DEFILLAMA_POOLS_URL = 'https://yields.llama.fi/pools';

export async function GET() {
  try {
    const response = await fetch(DEFILLAMA_POOLS_URL, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `DeFiLlama API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch from DeFiLlama' },
      { status: 502 }
    );
  }
}
