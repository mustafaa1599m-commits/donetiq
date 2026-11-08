import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { prisma } from './prisma';

const COOKIE = 'session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 أيام

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set and at least 32 characters');
  return new TextEncoder().encode(s);
}

export function newOverlayToken() {
  return randomBytes(24).toString('base64url');
}

export async function setSessionCookie(user) {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

// يعيد المستخدم الحالي (مع ملف صانع المحتوى) أو null
export async function getSessionUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { creator: { include: { alertSettings: true } } },
    });
  } catch {
    return null;
  }
}

export async function requireCreator() {
  const user = await getSessionUser();
  if (!user || !user.creator) return null;
  return { user, creator: user.creator };
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}
