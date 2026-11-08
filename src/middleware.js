import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// يحمي صفحات /dashboard و /admin (واجهات الـ API تتحقق من الجلسة بنفسها).
export async function middleware(req) {
  const token = req.cookies.get('session')?.value;
  const loginUrl = new URL('/login', req.url);

  if (!token || !process.env.JWT_SECRET) return NextResponse.redirect(loginUrl);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), {
      algorithms: ['HS256'],
    });
    if (req.nextUrl.pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
