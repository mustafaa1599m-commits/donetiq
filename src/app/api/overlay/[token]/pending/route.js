import { prisma } from '@/lib/prisma';
import { json, clientIp } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';
import { toAlert } from '@/lib/donations';

export const dynamic = 'force-dynamic';

// البديل عند عدم توفر WebSocket (مثل Vercel) وشبكة الأمان عند انقطاعه:
// يعيد التبرعات المدفوعة التي لم يُؤكَّد عرضها بعد (آخر 15 دقيقة فقط).
export async function GET(req, { params }) {
  if (!rateLimit(`ovpend:${clientIp(req)}`, 60, 60 * 1000)) return json({ error: 'rate limited' }, 429);

  const creator = await prisma.creator.findUnique({
    where: { overlayToken: params.token },
    select: { id: true, alertSettings: { select: { minAlertAmount: true } } },
  });
  if (!creator) return json({ error: 'not found' }, 404);

  const min = creator.alertSettings ? creator.alertSettings.minAlertAmount : 1000;
  const since = new Date(Date.now() - 15 * 60 * 1000);

  const rows = await prisma.donation.findMany({
    where: {
      creatorId: creator.id,
      status: 'PAID',
      alertAckedAt: null,
      paidAt: { gte: since },
      amount: { gte: min },
    },
    orderBy: { paidAt: 'asc' },
    take: 10,
  });

  return json({ alerts: rows.map(toAlert) });
}
