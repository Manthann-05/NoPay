import { NextResponse } from 'next/server';

/** Lightweight connectivity probe — does not touch MongoDB. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
