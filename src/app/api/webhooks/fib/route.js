import { prisma } from '@/lib/prisma';
import { json, readJson, safeEqual } from '@/lib/http';
import { reconcileDonation } from '@/lib/donations';

export const dynamic = 'force-dynamic';

// FIB يرسل POST {id, status} عند تغيّر حالة الدفع. الطلب غير موقّع، لذلك:
//  1) الرابط يحمل ?secret=WEBHOOK_SECRET نتحقق منه.
//  2) لا نثق بحقل status: نستعلم من FIB مباشرة (reconcileDonation) قبل أي تعديل مالي.
export async function POST(req) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (!process.env.WEBHOOK_SECRET || !safeEqual(secret, process.env.WEBHOOK_SECRET)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const body = await readJson(req);
  const paymentId = body && typeof body.id === 'string' ? body.id : null;
  if (!paymentId) return json({ error: 'bad request' }, 400);

  const donation = await prisma.donation.findFirst({
    where: { gateway: 'FIB', gatewayPaymentId: paymentId },
    select: { id: true },
  });
  if (!donation) return json({ ok: true }); // غير معروف: نرد 200 حتى لا تعيد البوابة المحاولة

  await reconcileDonation(donation.id);
  return json({ ok: true });
}
