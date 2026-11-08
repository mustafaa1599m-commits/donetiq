import { prisma } from '@/lib/prisma';
import { json } from '@/lib/http';
import { requireCreator } from '@/lib/auth';
import { config, PAYOUT_METHODS, PAYOUT_METHOD_LABELS } from '@/lib/config';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  minAlertAmount: 1000,
  durationMs: 8000,
  animation: 'bounce',
  primaryColor: '#FFD400',
  textColor: '#FFFFFF',
  titleTemplate: '{name} تبرّع بـ {amount}',
  showMessage: true,
  soundUrl: null,
  soundVolume: 80,
  ttsEnabled: false,
  bannedWords: [],
};

export async function GET() {
  const auth = await requireCreator();
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const { creator } = auth;

  const [donations, payouts, paidCount, pendingPayoutAgg] = await Promise.all([
    prisma.donation.findMany({
      where: { creatorId: creator.id, status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      take: 50,
      select: { id: true, donorName: true, message: true, amount: true, creatorAmount: true, paidAt: true },
    }),
    prisma.payout.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.donation.count({ where: { creatorId: creator.id, status: 'PAID' } }),
    prisma.payout.aggregate({
      where: { creatorId: creator.id, status: { in: ['REQUESTED', 'APPROVED'] } },
      _sum: { amount: true },
    }),
  ]);

  const s = creator.alertSettings || DEFAULT_SETTINGS;

  return json({
    creator: {
      username: creator.username,
      displayName: creator.displayName,
      bio: creator.bio,
      avatarUrl: creator.avatarUrl,
      tiktokHandle: creator.tiktokHandle,
      minDonation: creator.minDonation,
    },
    stats: {
      balance: creator.balance,
      totalEarned: creator.totalEarned,
      donationCount: paidCount,
      pendingPayouts: pendingPayoutAgg._sum.amount || 0,
    },
    urls: {
      donate: `${config.appUrl}/donate/${creator.username}`,
      overlay: `${config.appUrl}/overlay/${creator.overlayToken}`,
    },
    donations,
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      accountInfo: p.accountInfo,
      status: p.status,
      adminNote: p.adminNote,
      createdAt: p.createdAt,
    })),
    settings: {
      minAlertAmount: s.minAlertAmount,
      durationMs: s.durationMs,
      animation: s.animation,
      primaryColor: s.primaryColor,
      textColor: s.textColor,
      titleTemplate: s.titleTemplate,
      showMessage: s.showMessage,
      soundUrl: s.soundUrl,
      soundVolume: s.soundVolume,
      ttsEnabled: s.ttsEnabled,
      bannedWords: s.bannedWords,
    },
    config: {
      feePercent: config.feePercent,
      minPayout: config.minPayout,
      payoutMethods: PAYOUT_METHODS.map((m) => ({ value: m, label: PAYOUT_METHOD_LABELS[m] })),
    },
  });
}
