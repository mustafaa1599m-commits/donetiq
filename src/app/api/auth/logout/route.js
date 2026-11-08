import { json } from '@/lib/http';
import { clearSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  clearSessionCookie();
  return json({ ok: true });
}
