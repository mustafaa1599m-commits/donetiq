'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const PRESETS = [1000, 5000, 10000, 25000];
const fmt = (n) => Number(n).toLocaleString('en-US');

export default function DonateForm({ creator, gateways, maxDonation }) {
  const [donorName, setDonorName] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState(5000);
  const [gateway, setGateway] = useState(gateways[0] ? gateways[0].name : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fib, setFib] = useState(null); // {donationId, action}
  const [paid, setPaid] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!gateway) return setError('لا توجد وسيلة دفع متاحة حالياً');
    setBusy(true);
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: creator.username, donorName, message, amount: Number(amount), gateway }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ');
        setBusy(false);
        return;
      }
      if (data.action.type === 'redirect') {
        window.location.href = data.action.url;
        return;
      }
      setFib({ donationId: data.donationId, action: data.action });
      setBusy(false);
    } catch {
      setError('تعذّر الاتصال بالخادم');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 text-center">
        {creator.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatarUrl} alt="" className="mx-auto mb-3 h-24 w-24 rounded-full border-2 border-brand object-cover" />
        ) : (
          <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full border-2 border-brand bg-panel2 text-4xl font-extrabold text-brand">
            {creator.displayName.slice(0, 1)}
          </div>
        )}
        <h1 className="text-2xl font-extrabold">{creator.displayName}</h1>
        {creator.tiktokHandle && (
          <p className="text-sm text-aqua" dir="ltr">@{creator.tiktokHandle}</p>
        )}
        {creator.bio && <p className="mt-2 text-slate-300">{creator.bio}</p>}
      </div>

      {paid ? (
        <div className="card text-center">
          <div className="mb-3 text-5xl">🎉</div>
          <h2 className="mb-1 text-xl font-bold">وصل تبرعك، شكراً لك!</h2>
          <p className="mb-4 text-slate-400">سيظهر اسمك على بث {creator.displayName} الآن.</p>
          <button className="btn-ghost" onClick={() => { setPaid(false); setFib(null); setMessage(''); }}>تبرع مرة أخرى</button>
        </div>
      ) : fib ? (
        <FibPanel fib={fib} amount={amount} onPaid={() => setPaid(true)} onCancel={() => setFib(null)} />
      ) : (
        <form onSubmit={submit} className="card space-y-5">
          <div>
            <label className="label" htmlFor="donorName">اسمك (يظهر على البث)</label>
            <input id="donorName" className="input" maxLength={30} value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="فاعل خير" />
          </div>

          <div>
            <label className="label" htmlFor="message">رسالتك (اختياري)</label>
            <textarea id="message" className="input min-h-[88px] resize-none" maxLength={150} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب رسالة للصانع..." />
            <p className="mt-1 text-left text-xs text-slate-500" dir="ltr">{message.length}/150</p>
          </div>

          <div>
            <span className="label">المبلغ بالدينار العراقي</span>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {PRESETS.filter((p) => p >= creator.minDonation).map((p) => (
                <button type="button" key={p} onClick={() => setAmount(p)}
                  className={`rounded-xl border py-2 text-sm font-bold transition ${Number(amount) === p ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-panel2 text-slate-300 hover:border-slate-500'}`}>
                  {fmt(p)}
                </button>
              ))}
            </div>
            <input type="number" inputMode="numeric" dir="ltr" className="input" min={creator.minDonation} max={maxDonation} step={250}
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">الحد الأدنى {fmt(creator.minDonation)} د.ع</p>
          </div>

          <div>
            <span className="label">وسيلة الدفع</span>
            {gateways.length === 0 ? (
              <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">لا توجد وسيلة دفع مفعّلة حالياً.</p>
            ) : (
              <div className="space-y-2">
                {gateways.map((g) => (
                  <label key={g.name} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${gateway === g.name ? 'border-aqua bg-aqua/10' : 'border-line bg-panel2'}`}>
                    <input type="radio" name="gateway" value={g.name} checked={gateway === g.name} onChange={() => setGateway(g.name)} className="accent-[#25F4EE]" />
                    <span className="font-medium">{g.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">{error}</p>}

          <button className="btn-primary w-full text-lg" disabled={busy || gateways.length === 0}>
            {busy ? 'جارٍ التحضير...' : `تبرّع بـ ${fmt(Number(amount) || 0)} د.ع`}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        مدعوم من <Link href="/" className="text-slate-300">Donatiq</Link>
      </p>
    </main>
  );
}

// لوحة الدفع عبر FIB: QR + كود يدوي + روابط التطبيق، مع polling حتى تأكيد الدفع
function FibPanel({ fib, amount, onPaid, onCancel }) {
  const { donationId, action } = fib;
  const [status, setStatus] = useState('PENDING');
  const [copied, setCopied] = useState(false);
  const stopped = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    stopped.current = false;
    const tick = async () => {
      if (stopped.current) return;
      try {
        const res = await fetch(`/api/donations/${donationId}`, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          if (d.status === 'PAID') {
            stopped.current = true;
            onPaidRef.current();
            return;
          }
          if (d.status === 'FAILED' || d.status === 'EXPIRED') {
            stopped.current = true;
            setStatus(d.status);
            return;
          }
        }
      } catch {
        /* نتجاهل أخطاء الشبكة المؤقتة */
      }
      setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 2500);
    return () => {
      stopped.current = true;
      clearTimeout(t);
    };
  }, [donationId]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(action.readableCode || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const appLink = action.links && (action.links.personal || action.links.business || action.links.corporate);

  if (status !== 'PENDING') {
    return (
      <div className="card text-center">
        <p className="mb-4 text-lg font-bold text-brand">
          {status === 'EXPIRED' ? 'انتهت صلاحية رمز الدفع' : 'لم تكتمل عملية الدفع'}
        </p>
        <button className="btn-primary" onClick={onCancel}>حاول مرة أخرى</button>
      </div>
    );
  }

  return (
    <div className="card space-y-4 text-center">
      <h2 className="text-lg font-bold">أكمل الدفع بقيمة {fmt(amount)} د.ع عبر FIB</h2>
      {action.qrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={action.qrCode} alt="FIB QR" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
      )}
      <p className="text-sm text-slate-400">امسح الرمز من تطبيق FIB، أو أدخل الكود يدوياً:</p>
      {action.readableCode && (
        <button onClick={copyCode} className="mx-auto block rounded-xl border border-dashed border-aqua px-5 py-2 font-mono text-xl tracking-widest text-aqua" dir="ltr">
          {action.readableCode} {copied ? '✓' : ''}
        </button>
      )}
      {appLink && (
        <a href={appLink} className="btn-primary w-full">فتح تطبيق FIB</a>
      )}
      <p className="flex items-center justify-center gap-2 text-sm text-slate-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
        بانتظار تأكيد الدفع...
      </p>
      <button className="text-sm text-slate-500 underline" onClick={onCancel}>إلغاء</button>
    </div>
  );
}
