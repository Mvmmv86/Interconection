import { NextRequest, NextResponse } from 'next/server';

const ZERION_API_BASE = 'https://api.zerion.io/v1';
const ZERION_API_KEY = process.env.NEXT_PUBLIC_ZERION_API_KEY || '';

function getAuthHeader(): string {
  return `Basic ${Buffer.from(ZERION_API_KEY + ':').toString('base64')}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter is required' }, { status: 400 });
  }

  // Forward all other query params to Zerion
  const zerionParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'wallet') {
      zerionParams.append(key, value);
    }
  });

  const url = `${ZERION_API_BASE}/wallets/${wallet}/positions/?${zerionParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': getAuthHeader(),
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Zerion API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch from Zerion' },
      { status: 502 }
    );
  }
}
