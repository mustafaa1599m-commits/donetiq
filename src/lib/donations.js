import { prisma } from './prisma';
import { getGateway } from './gateways';
import { emitToOverlay } from './realtime';

// شكل التنبيه الذي يُرسل إلى صفحة البث
export function toAlert(d) {
  return {
    id: d.id,
    name: d.donorName,
    amount: d.amount,
    message: d.message || '',
    paidAt: (d.paidAt || new Date()).toISOString(),
  };
}

// يحوّل التبرع إلى PAID مرة واحدة فقط (idempotent)، يضيف حصة الصانع لرصيده،
// ثم يطلق التنبيه الفوري. آمن عند استدعائه من webhook مكرر أو من polling.
export async function markDonationPaid(donationId) {
  const paid = await prisma.$transaction(async (tx) => {
    const upd = await tx.donation.updateMany({
      where: { id: donationId, status: { in: ['PENDING', 'EXPIRED'] } },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (upd.count === 0) return null; // تمت معالجته سابقاً

    const d = await tx.donation.findUnique({ where: { id: donationId } });
    await tx.creator.update({
      where: { id: d.creatorId },
      data: {
        balance: { increment: d.creatorAmount },
        totalEarned: { increment: d.creatorAmount },
      },
    });
    return d;
  });

  if (!paid) return null;

  try {
    const creator = await prisma.creator.findUnique({
      where: { id: paid.creatorId },
      include: { alertSettings: true },
    });
    const min = creator.alertSettings ? creator.alertSettings.minAlertAmount : 1000;
    if (paid.amount >= min) {
      emitToOverlay(creator.overlayToken, 'alert', toAlert(paid));
    }
  } catch (err) {
    // فشل التنبيه لا يجب أن يفشل الدفع: صفحة التنبيه ستلتقطه بالـ polling
    console.error('[alert emit failed]', err);
  }
  return paid;
}

// يستعلم من البوابة عن حالة تبرع معلّق ويحدّثه. مصدر الحقيقة هو البوابة وليس الطلب القادم.
export async function reconcileDonation(donationId) {
  const d = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!d || d.status !== 'PENDING' || !d.gatewayPaymentId) return d;

  let result;
  try {
    result = await getGateway(d.gateway).checkStatus(d);
  } catch (err) {
    console.error(`[reconcile ${d.gateway} ${d.id}]`, err.message);
    return d;
  }

  if (result.status === 'PAID') {
    if (result.amount != null && Number(result.amount) !== d.amount) {
      console.error(`[reconcile] AMOUNT MISMATCH donation=${d.id} expected=${d.amount} got=${result.amount}`);
      return d;
    }
    await markDonationPaid(d.id);
  } else if (result.status === 'FAILED' || result.status === 'EXPIRED') {
    await prisma.donation.updateMany({
      where: { id: d.id, status: 'PENDING' },
      data: { status: result.status },
    });
  }

  return prisma.donation.findUnique({ where: { id: donationId } });
}
