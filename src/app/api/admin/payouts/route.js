import { prisma } from '@/lib/prisma';
import { json } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return json({ error: 'unauthorized' }, 401);

  const [payouts, paidAgg, creatorCount, owedAgg] = await Promise.all([
    prisma.payout.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: { creator: { select: { username: true, displayName: true } } },
    }),
    prisma.donation.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true, platformFee: true, creatorAmount: true },
      _count: true,
    }),
    prisma.creator.count(),
    prisma.creator.aggregate({ _sum: { balance: true } }),
  ]);

  return json({
    payouts,
    totals: {
      donationCount: paidAgg._count,
      gross: paidAgg._sum.amount || 0,
      platformFees: paidAgg._sum.platformFee || 0,
      creatorShares: paidAgg._sum.creatorAmount || 0,
      creatorBalances: owedAgg._sum.balance || 0,
      creatorCount,
    },
  });
}
