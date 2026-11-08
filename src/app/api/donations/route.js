import { prisma } from '@/lib/prisma';
import { json, readJson, clientIp } from '@/lib/http';
import { validateDonation } from '@/lib/validate';
import { splitAmount } from '@/lib/money';
import { config } from '@/lib/config';
import { rateLimit } from '@/lib/ratelimit';
import { getGateway, isGatewayEnabled } from '@/lib/gateways';

export const dynamic = 'force-dynamic';

// إنشاء عملية دفع: يحسب العمولة تلقائياً (افتراضي 30% منصة / 70% صانع المحتوى)
// ثم ينشئ الدفع عند البوابة ويعيد للواجهة ما تحتاجه (رابط تحويل أو QR).
export async function POST(req) {
  if (!rateLimit(`don:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return json({ error: 'محاولات كثيرة، حاول بعد قليل' }, 429);
  }

  const body = await readJson(req);
  if (!body) return json({ error: 'طلب غير صالح' }, 400);

  const v = validateDonation(body);
  if (v.error) return json({ error: v.error }, 400);
  const { username, donorName, message, amount, gateway } = v.value;

  if (!isGatewayEnabled(gateway)) return json({ error: 'وسيلة الدفع غير متاحة حالياً' }, 400);

  const creator = await prisma.creator.findUnique({ where: { username } });
  if (!creator || !creator.isActive) return json({ error: 'صانع المحتوى غير موجود' }, 404);
  if (amount < creator.minDonation) {
    return json({ error: `أقل مبلغ لهذا الصانع ${creator.minDonation.toLocaleString('en-US')} د.ع` }, 400);
  }

  const feePercent = config.feePercent;
  const { platformFee, creatorAmount } = splitAmount(amount, feePercent);

  const donation = await prisma.donation.create({
    data: {
      creatorId: creator.id,
      donorName,
      message: message || null,
      amount,
      feePercent,
      platformFee,
      creatorAmount,
      gateway,
      status: 'PENDING',
    },
  });

  try {
    const pay = await getGateway(gateway).createPayment({ donation, creator });
    await prisma.donation.update({
      where: { id: donation.id },
      data: {
        gatewayPaymentId: pay.paymentId,
        gatewayRef: pay.ref || null,
        checkoutUrl: pay.action.type === 'redirect' ? pay.action.url : null,
        expiresAt: pay.expiresAt || null,
      },
    });
    return json({ donationId: donation.id, action: pay.action });
  } catch (err) {
    console.error(`[create payment ${gateway}]`, err.message);
    await prisma.donation.update({ where: { id: donation.id }, data: { status: 'FAILED' } });
    return json({ error: 'تعذّر إنشاء عملية الدفع، حاول مرة أخرى' }, 502);
  }
}
