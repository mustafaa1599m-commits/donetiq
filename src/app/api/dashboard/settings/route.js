import { prisma } from '@/lib/prisma';
import { json, readJson } from '@/lib/http';
import { requireCreator } from '@/lib/auth';
import { validateAlertSettings } from '@/lib/validate';
import { emitToOverlay } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function PUT(req) {
  const auth = await requireCreator();
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const body = await readJson(req);
  if (!body) return json({ error: 'طلب غير صالح' }, 400);

  const v = validateAlertSettings(body);
  if (v.error) return json({ error: v.error }, 400);

  const settings = await prisma.alertSettings.upsert({
    where: { creatorId: auth.creator.id },
    update: v.value,
    create: { creatorId: auth.creator.id, ...v.value },
  });

  // إشعار صفحة التنبيه المفتوحة لتحميل الإعدادات الجديدة فوراً
  emitToOverlay(auth.creator.overlayToken, 'config-updated', {});
  return json({ ok: true, settings });
}
