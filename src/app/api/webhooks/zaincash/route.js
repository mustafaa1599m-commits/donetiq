import { prisma } from '@/lib/prisma';
import { json, readJson } from '@/lib/http';
import { reconcileDonation } from '@/lib/donations';
import { verifyZainCashToken } from '@/lib/gateways/zaincash';

export const dynamic = 'force-dynamic';

// ZainCash يرسل {webhook_token: JWT} موقّعاً HS256 بمفتاح الـ API.
// نتحقق من التوقيع، ثم نحدد التبرع بمعرّفاته المحتملة، ثم نؤكد الحالة بالاستعلام (inquiry).
// الأحداث المكررة آمنة: markDonationPaid لا يعمل إلا مرة واحدة.
export async function POST(req) {
  const body = await readJson(req);
  const token = body && typeof body.webhook_token === 'string' ? body.webhook_token : null;
  if (!token) return json({ error: 'bad request' }, 400);

  let payload;
  try {
    payload = await verifyZainCashToken(token);
  } catch {
    return json({ error: 'invalid signature' }, 401);
  }

  const candidates = [
    payload.transactionId,
    payload.externalReferenceId,
    payload.orderId,
    payload.data && payload.data.transactionId,
    payload.data && payload.data.externalReferenceId,
    payload.data && payload.data.orderId,
  ].filter((x) => typeof x === 'string' && x.length > 0);

  if (candidates.length === 0) return json({ ok: true });

  const donation = await prisma.donation.findFirst({
    where: {
      gateway: 'ZAINCASH',
      OR: [
        { gatewayPaymentId: { in: candidates } },
        { gatewayRef: { in: candidates } },
        { id: { in: candidates } },
      ],
    },
    select: { id: true },
  });

  if (donation) await reconcileDonation(donation.id);
  return json({ ok: true });
}
