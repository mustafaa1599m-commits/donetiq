import { prisma } from '@/lib/prisma';
import { json } from '@/lib/http';
import { config } from '@/lib/config';
import { markDonationPaid } from '@/lib/donations';

export const dynamic = 'force-dynamic';

// إتمام دفع تجريبي (للاختبار فقط). مغلق تماماً ما لم يكن ALLOW_MOCK_PAYMENTS=true.
export async function POST(_req, { params }) {
  if (!config.allowMock) return json({ error: 'disabled' }, 403);

  const d = await prisma.donation.findUnique({ where: { id: params.id } });
  if (!d || d.gateway !== 'MOCK') return json({ error: 'not found' }, 404);

  await markDonationPaid(d.id);
  return json({ ok: true });
}
