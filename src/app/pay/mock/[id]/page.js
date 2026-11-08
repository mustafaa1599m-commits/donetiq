'use client';

import { useState } from 'react';

// صفحة دفع تجريبية: تحاكي بوابة الدفع (تعمل فقط عند ALLOW_MOCK_PAYMENTS=true)
export default function MockPay({ params }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/pay/mock/${params.id}`, { method: 'POST' });
      if (!res.ok) {
        setError('الدفع التجريبي غير متاح');
        setBusy(false);
        return;
      }
      window.location.href = `/pay/return/${params.id}`;
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <div className="card space-y-4 text-center">
        <span className="mx-auto rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold">بوابة تجريبية</span>
        <h1 className="text-xl font-bold">محاكاة الدفع</h1>
        <p className="text-slate-400">هذه الصفحة تحاكي بوابة الدفع لاختبار الدورة كاملة. لن يُخصم أي مبلغ حقيقي.</p>
        {error && <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">{error}</p>}
        <button className="btn-primary w-full" onClick={pay} disabled={busy}>{busy ? 'جارٍ المعالجة...' : 'تأكيد الدفع (تجريبي)'}</button>
      </div>
    </main>
  );
}
