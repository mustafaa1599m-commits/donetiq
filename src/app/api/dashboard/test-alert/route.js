import { json } from '@/lib/http';
import { requireCreator } from '@/lib/auth';
import { emitToOverlay } from '@/lib/realtime';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// تنبيه تجريبي (لا يُحفظ ولا يؤثر على الرصيد). يتطلب Socket.io، أي خادم Render/VPS.
// على Vercel استخدم رابط التنبيه مع ?demo=1 للمعاينة.
export async function POST() {
  const auth = await requireCreator();
  if (!auth) return json({ error: 'unauthorized' }, 401);
  if (!rateLimit(`testalert:${auth.creator.id}`, 10, 60 * 1000)) return json({ error: 'rate limited' }, 429);

  const delivered = emitToOverlay(auth.creator.overlayToken, 'alert', {
    id: `test-${Date.now()}`,
    name: 'متبرع تجريبي',
    amount: 5000,
    message: 'هذا تنبيه تجريبي 🎉',
    paidAt: new Date().toISOString(),
    test: true,
  });

  if (!delivered) {
    return json({ ok: false, error: 'الخادم الحالي لا يدعم WebSocket. استخدم رابط المعاينة ?demo=1' }, 200);
  }
  return json({ ok: true });
}
