import { prisma } from '@/lib/prisma';
import { json } from '@/lib/http';
import { requireCreator, newOverlayToken } from '@/lib/auth';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

// تغيير رابط التنبيه إذا تسرّب. الرابط القديم يتوقف فوراً.
export async function POST() {
  const auth = await requireCreator();
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const token = newOverlayToken();
  await prisma.creator.update({ where: { id: auth.creator.id }, data: { overlayToken: token } });
  return json({ ok: true, overlayUrl: `${config.appUrl}/overlay/${token}` });
}
