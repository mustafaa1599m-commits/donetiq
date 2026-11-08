import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { json, readJson, clientIp } from '@/lib/http';
import { validateRegister } from '@/lib/validate';
import { setSessionCookie, newOverlayToken } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!rateLimit(`reg:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return json({ error: 'محاولات كثيرة، حاول بعد قليل' }, 429);
  }

  const body = await readJson(req);
  if (!body) return json({ error: 'طلب غير صالح' }, 400);

  const v = validateRegister(body);
  if (v.error) return json({ error: v.error }, 400);
  const { email, password, username, displayName } = v.value;

  const [emailTaken, nameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.creator.findUnique({ where: { username }, select: { id: true } }),
  ]);
  if (emailTaken) return json({ error: 'البريد الإلكتروني مسجّل مسبقاً' }, 409);
  if (nameTaken) return json({ error: 'اسم المستخدم مستخدم مسبقاً' }, 409);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'CREATOR',
        creator: {
          create: {
            username,
            displayName,
            overlayToken: newOverlayToken(),
            alertSettings: { create: {} },
          },
        },
      },
    });
    await setSessionCookie(user);
    return json({ ok: true });
  } catch (err) {
    // تعارض سباق (race) على unique
    if (err && err.code === 'P2002') return json({ error: 'البريد أو اسم المستخدم مستخدم مسبقاً' }, 409);
    console.error('[register]', err);
    return json({ error: 'حدث خطأ غير متوقع' }, 500);
  }
}
