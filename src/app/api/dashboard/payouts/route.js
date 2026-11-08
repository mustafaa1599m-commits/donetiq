import { prisma } from '@/lib/prisma';
import { json, readJson } from '@/lib/http';
import { requireCreator } from '@/lib/auth';
import { validatePayout } from '@/lib/validate';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

// طلب سحب: يُخصم المبلغ من الرصيد فوراً داخل معاملة ذرية (لا يمكن السحب مرتين من نفس الرصيد).
// عند رفض الطلب من الأدمن يُعاد المبلغ للرصيد.
export async function POST(req) {
  const auth = await requireCreator();
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const body = await readJson(req);
  if (!body) return json({ error: 'طلب غير صالح' }, 400);

  const v = validatePayout(body);
  if (v.error) return json({ error: v.error }, 400);
  const { amount, method, accountInfo } = v.value;

  if (amount < config.minPayout) {
    return json({ error: `الحد الأدنى للسحب ${config.minPayout.toLocaleString('en-US')} د.ع` }, 400);
  }

  try {
    const payout = await prisma.$transaction(async (tx) => {
      const r = await tx.creator.updateMany({
        where: { id: auth.creator.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (r.count === 0) throw new Error('INSUFFICIENT_BALANCE');
      return tx.payout.create({
        data: { creatorId: auth.creator.id, amount, method, accountInfo },
      });
    });
    return json({ ok: true, payoutId: payout.id });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') return json({ error: 'الرصيد غير كافٍ' }, 400);
    console.error('[payout]', err);
    return json({ error: 'حدث خطأ غير متوقع' }, 500);
  }
}
