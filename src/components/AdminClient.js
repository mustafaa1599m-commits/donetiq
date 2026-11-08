'use client';

import { useCallback, useEffect, useState } from 'react';

const fmt = (n) => Number(n).toLocaleString('en-US');
const fmtDate = (d) => (d ? new Date(d).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : '');

const STATUS = {
  REQUESTED: { label: 'جديد', cls: 'bg-gold/15 text-gold' },
  APPROVED: { label: 'موافَق عليه', cls: 'bg-aqua/15 text-aqua' },
  PAID: { label: 'تم التحويل', cls: 'bg-emerald-500/15 text-emerald-400' },
  REJECTED: { label: 'مرفوض', cls: 'bg-brand/15 text-brand' },
};

export default function AdminClient() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/payouts', { cache: 'no-store' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id, action) {
    let note = null;
    if (action === 'reject') {
      note = window.prompt('سبب الرفض (يظهر لصانع المحتوى):') || null;
    }
    if (action === 'paid' && !window.confirm('هل حوّلت المبلغ فعلياً لصانع المحتوى؟')) return;
    const res = await fetch(`/api/admin/payouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? 'تم التحديث' : d.error || 'فشل');
    setTimeout(() => setMsg(''), 3000);
    load();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    window.location.href = '/login';
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-aqua" />
      </main>
    );
  }

  const t = data.totals;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">لوحة الإدارة</h1>
        <button onClick={logout} className="btn-ghost btn-sm">تسجيل خروج</button>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['عدد الصنّاع', fmt(t.creatorCount)],
          ['عدد التبرعات', fmt(t.donationCount)],
          ['إجمالي المدفوع', `${fmt(t.gross)}`],
          ['أرباح المنصة', `${fmt(t.platformFees)}`],
          ['حصص الصنّاع', `${fmt(t.creatorShares)}`],
          ['أرصدة مستحقة للصنّاع', `${fmt(t.creatorBalances)}`],
        ].map(([l, v]) => (
          <div key={l} className="card">
            <p className="text-xs text-slate-400">{l}</p>
            <p className="mt-1 text-xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-bold">طلبات السحب</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-line text-slate-400">
            <tr>
              <th className="p-3">الصانع</th>
              <th className="p-3">المبلغ</th>
              <th className="p-3">الوسيلة</th>
              <th className="p-3">بيانات الحساب</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">التاريخ</th>
              <th className="p-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {data.payouts.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">لا توجد طلبات</td></tr>
            )}
            {data.payouts.map((p) => {
              const st = STATUS[p.status];
              const open = p.status === 'REQUESTED' || p.status === 'APPROVED';
              return (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="p-3">
                    <div className="font-bold">{p.creator.displayName}</div>
                    <div className="text-xs text-slate-500" dir="ltr">@{p.creator.username}</div>
                  </td>
                  <td className="p-3 font-bold">{fmt(p.amount)}</td>
                  <td className="p-3">{p.method}</td>
                  <td className="p-3 font-mono text-xs" dir="ltr">{p.accountInfo}</td>
                  <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                  <td className="p-3 text-slate-400">{fmtDate(p.createdAt)}</td>
                  <td className="p-3">
                    {open && (
                      <div className="flex flex-wrap gap-1">
                        {p.status === 'REQUESTED' && <button className="btn-ghost btn-sm" onClick={() => act(p.id, 'approve')}>موافقة</button>}
                        <button className="btn-primary btn-sm" onClick={() => act(p.id, 'paid')}>تم التحويل</button>
                        <button className="btn-ghost btn-sm text-brand" onClick={() => act(p.id, 'reject')}>رفض</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {msg && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white shadow-xl">{msg}</div>}
    </main>
  );
}
