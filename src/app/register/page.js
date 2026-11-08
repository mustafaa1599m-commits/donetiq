'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل إنشاء الحساب');
        setBusy(false);
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 text-center text-2xl font-extrabold">
        Dona<span className="text-brand">tiq</span>
      </Link>
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-xl font-bold">إنشاء حساب صانع محتوى</h1>
        <div>
          <label className="label" htmlFor="displayName">الاسم الظاهر</label>
          <input id="displayName" required maxLength={40} className="input" value={form.displayName} onChange={set('displayName')} />
        </div>
        <div>
          <label className="label" htmlFor="username">اسم المستخدم (يظهر في رابط صفحتك)</label>
          <input id="username" required dir="ltr" pattern="[a-zA-Z0-9_]{3,20}" className="input" placeholder="my_channel"
            value={form.username} onChange={set('username')} autoComplete="username" />
          <p className="mt-1 text-xs text-slate-500" dir="ltr">/donate/{form.username.toLowerCase() || 'username'}</p>
        </div>
        <div>
          <label className="label" htmlFor="email">البريد الإلكتروني</label>
          <input id="email" type="email" dir="ltr" required className="input" value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">كلمة المرور (8 أحرف على الأقل)</label>
          <input id="password" type="password" dir="ltr" required minLength={8} maxLength={72} className="input"
            value={form.password} onChange={set('password')} autoComplete="new-password" />
        </div>
        {error && <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}</button>
        <p className="text-center text-sm text-slate-400">
          لديك حساب؟ <Link href="/login" className="text-aqua">سجّل الدخول</Link>
        </p>
      </form>
    </main>
  );
}
