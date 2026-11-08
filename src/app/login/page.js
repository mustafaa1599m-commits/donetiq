'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل تسجيل الدخول');
        setBusy(false);
        return;
      }
      window.location.href = data.role === 'ADMIN' ? '/admin' : '/dashboard';
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <Link href="/" className="mb-8 text-center text-2xl font-extrabold">
        Dona<span className="text-brand">tiq</span>
      </Link>
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-xl font-bold">تسجيل الدخول</h1>
        <div>
          <label className="label" htmlFor="email">البريد الإلكتروني</label>
          <input id="email" type="email" dir="ltr" required className="input" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">كلمة المرور</label>
          <input id="password" type="password" dir="ltr" required className="input" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
        </div>
        {error && <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ الدخول...' : 'دخول'}</button>
        <p className="text-center text-sm text-slate-400">
          ليس لديك حساب؟ <Link href="/register" className="text-aqua">أنشئ حساباً</Link>
        </p>
      </form>
    </main>
  );
}
