import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { json, readJson, clientIp } from '@/lib/http';
import { setSessionCookie } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// hash وهمي لتساوي زمن الاستجابة سواء وُجد المستخدم أم لا (يمنع كشف البريدات المسجّلة بقياس الزمن)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export async function POST(req) {
  const ip = clientIp(req);
  const body = await readJson(req);
  if (!body) return json({ error: 'طلب غير صالح' }, 400);

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!rateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000) || !rateLimit(`login-em:${email}`, 8, 15 * 60 * 1000)) {
    return json({ error: 'محاولات كثيرة، حاول بعد 15 دقيقة' }, 429);
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const valid = await bcrypt.compare(password.slice(0, 72), user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) return json({ error: 'البريد أو كلمة المرور غير صحيحة' }, 401);

  await setSessionCookie(user);
  return json({ ok: true, role: user.role });
}
