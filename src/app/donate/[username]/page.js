import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { enabledGateways } from '@/lib/gateways';
import { config } from '@/lib/config';
import DonateForm from '@/components/DonateForm';

export const dynamic = 'force-dynamic';

async function loadCreator(username) {
  return prisma.creator.findUnique({
    where: { username: String(username).toLowerCase() },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      tiktokHandle: true,
      minDonation: true,
      isActive: true,
    },
  });
}

export async function generateMetadata({ params }) {
  const c = await loadCreator(params.username);
  if (!c || !c.isActive) return { title: 'غير موجود' };
  return { title: `ادعم ${c.displayName}`, description: c.bio || `تبرّع لـ ${c.displayName} أثناء البث المباشر` };
}

export default async function DonatePage({ params }) {
  const creator = await loadCreator(params.username);
  if (!creator || !creator.isActive) notFound();

  return (
    <DonateForm
      creator={{
        username: creator.username,
        displayName: creator.displayName,
        bio: creator.bio,
        avatarUrl: creator.avatarUrl,
        tiktokHandle: creator.tiktokHandle,
        minDonation: Math.max(creator.minDonation, config.minDonation),
      }}
      gateways={enabledGateways()}
      maxDonation={config.maxDonation}
    />
  );
}
