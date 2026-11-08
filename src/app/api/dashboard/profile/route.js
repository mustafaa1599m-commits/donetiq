import { prisma } from '@/lib/prisma';
import { json, readJson } from '@/lib/http';
import { requireCreator } from '@/lib/auth';
import { validateProfile } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function PUT(req) {
  const auth = await requireCreator();
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const body = await readJson(req);
  if (!body) return json({ error: 'طلب غير صالح' }, 400);

  const v = validateProfile(body);
  if (v.error) return json({ error: v.error }, 400);

  await prisma.creator.update({ where: { id: auth.creator.id }, data: v.value });
  return json({ ok: true });
}
