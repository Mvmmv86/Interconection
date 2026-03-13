import { NextResponse } from 'next/server';

export async function GET() {
  const hasDefault = !!process.env.GLM_API_KEY;
  return NextResponse.json({ hasDefaultKey: hasDefault });
}
