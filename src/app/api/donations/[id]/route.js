import { prisma } from '@/lib/prisma';
import { json } from '@/lib/http';
import { reconcileDonation } from '@/lib/donations';

export const dynamic = 'force-dynamic';

// حالة التبرع للمتبرع (polling من صفحة الدفع). نحدّ استعلام البوابة إلى مرة كل ~4 ثوانٍ لكل تبرع.
const lastCheck = new Map();

export async function GET(_req, { params }) {
  const id = params.id;
  if (!id || id.length > 64) return json({ error: 'not found' }, 404);

  let d = await prisma.donation.findUnique({
    where: { id },
    include: { creator: { select: { username: true, displayName: true } } },
  });
  if (!d) return json({ error: 'not found' }, 404);

  if (d.status === 'PENDING') {
    const now = Date.now();
    if (now - (lastCheck.get(id) || 0) > 4000) {
      lastCheck.set(id, now);
      if (lastCheck.size > 2000) lastCheck.clear();
      const fresh = await reconcileDonation(id);
      if (fresh) d = { ...d, status: fresh.status };
    }
  }

  return json({
    status: d.status,
    amount: d.amount,
    creator: d.creator,
  });
}
