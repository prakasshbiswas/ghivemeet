import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('Recording is disabled', { status: 404 });
}
