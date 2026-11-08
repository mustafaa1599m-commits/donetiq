import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

// نقبل JSON فقط. اشتراط Content-Type: application/json يمنع هجمات CSRF عبر النماذج العادية.
export async function readJson(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

export function clientIp(req) {
  const xf = req.headers.get('x-forwarded-for');
  return (xf ? xf.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
