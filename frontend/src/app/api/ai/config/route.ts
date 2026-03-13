import { NextResponse } from 'next/server';

export async function GET() {
  const hasDefault = !!process.env.GEMINI_API_KEY;
  return NextResponse.json({ hasDefaultKey: hasDefault });
}
