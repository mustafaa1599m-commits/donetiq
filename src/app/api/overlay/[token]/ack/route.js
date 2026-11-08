import { prisma } from '@/lib/prisma';
import { json, readJson, clientIp } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// صفحة التنبيه تؤكد أنها عرضت التبرعات حتى لا تُعرض مرة ثانية بعد إعادة تحميل OBS.
export async function POST(req, { params }) {
  if (!rateLimit(`ovack:${clientIp(req)}`, 60, 60 * 1000)) return json({ error: 'rate limited' }, 429);

  const body = await readJson(req);
  const ids = body && Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').slice(0, 20) : [];
  if (ids.length === 0) return json({ ok: true });

  const creator = await prisma.creator.findUnique({
    where: { overlayToken: params.token },
    select: { id: true },
  });
  if (!creator) return json({ error: 'not found' }, 404);

  await prisma.donation.updateMany({
    where: { id: { in: ids }, creatorId: creator.id, alertAckedAt: null },
    data: { alertAckedAt: new Date() },
  });
  return json({ ok: true });
}
