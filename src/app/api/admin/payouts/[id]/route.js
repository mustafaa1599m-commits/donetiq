import { prisma } from '@/lib/prisma';
import { json, readJson } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { cleanText } from '@/lib/validate';

export const dynamic = 'force-dynamic';

// إجراءات الأدمن على طلب سحب:
//  approve: REQUESTED -> APPROVED
//  paid:    REQUESTED|APPROVED -> PAID  (بعد أن حوّلت المبلغ فعلياً لصانع المحتوى)
//  reject:  REQUESTED|APPROVED -> REJECTED + إعادة المبلغ لرصيده
export async function PATCH(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return json({ error: 'unauthorized' }, 401);

  const body = await readJson(req);
  const action = body && body.action;
  const note = body && body.note ? cleanText(body.note, 200) : null;
  if (!['approve', 'paid', 'reject'].includes(action)) return json({ error: 'إجراء غير صالح' }, 400);

  try {
    await prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({ where: { id: params.id } });
      if (!payout) throw new Error('NOT_FOUND');

      if (action === 'approve') {
        const r = await tx.payout.updateMany({
          where: { id: payout.id, status: 'REQUESTED' },
          data: { status: 'APPROVED', adminNote: note },
        });
        if (r.count === 0) throw new Error('BAD_STATE');
      } else if (action === 'paid') {
        const r = await tx.payout.updateMany({
          where: { id: payout.id, status: { in: ['REQUESTED', 'APPROVED'] } },
          data: { status: 'PAID', processedAt: new Date(), adminNote: note },
        });
        if (r.count === 0) throw new Error('BAD_STATE');
      } else {
        const r = await tx.payout.updateMany({
          where: { id: payout.id, status: { in: ['REQUESTED', 'APPROVED'] } },
          data: { status: 'REJECTED', processedAt: new Date(), adminNote: note },
        });
        if (r.count === 0) throw new Error('BAD_STATE');
        await tx.creator.update({
          where: { id: payout.creatorId },
          data: { balance: { increment: payout.amount } },
        });
      }
    });
    return json({ ok: true });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return json({ error: 'غير موجود' }, 404);
    if (err.message === 'BAD_STATE') return json({ error: 'لا يمكن تنفيذ الإجراء على حالة الطلب الحالية' }, 409);
    console.error('[admin payout]', err);
    return json({ error: 'حدث خطأ غير متوقع' }, 500);
  }
}
