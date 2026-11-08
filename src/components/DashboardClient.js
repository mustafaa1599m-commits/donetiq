'use client';

import { useCallback, useEffect, useState } from 'react';

const fmt = (n) => Number(n).toLocaleString('en-US');
const fmtDate = (d) => (d ? new Date(d).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : '');

const PAYOUT_STATUS = {
  REQUESTED: { label: 'قيد المراجعة', cls: 'bg-gold/15 text-gold' },
  APPROVED: { label: 'تمت الموافقة', cls: 'bg-aqua/15 text-aqua' },
  PAID: { label: 'تم التحويل', cls: 'bg-emerald-500/15 text-emerald-400' },
  REJECTED: { label: 'مرفوض (أُعيد الرصيد)', cls: 'bg-brand/15 text-brand' },
};

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'donations', label: 'التبرعات' },
  { id: 'payouts', label: 'السحب' },
  { id: 'alerts', label: 'إعدادات التنبيه' },
  { id: 'profile', label: 'الملف الشخصي' },
];

async function api(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { ok: res.ok, status: res.status, data };
}

export default function DashboardClient() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const r = await api('/api/dashboard/summary', 'GET');
    if (r.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (r.ok) setData(r.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  async function logout() {
    await api('/api/auth/logout', 'POST', {});
    window.location.href = '/login';
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-aqua" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">أهلاً {data.creator.displayName}</h1>
          <p className="text-sm text-slate-400" dir="ltr">@{data.creator.username}</p>
        </div>
        <button onClick={logout} className="btn-ghost btn-sm">تسجيل خروج</button>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition ${tab === t.id ? 'bg-brand text-white' : 'text-slate-300 hover:bg-panel2'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview data={data} notify={notify} reload={load} />}
      {tab === 'donations' && <Donations data={data} />}
      {tab === 'payouts' && <Payouts data={data} notify={notify} reload={load} />}
      {tab === 'alerts' && <AlertSettings data={data} notify={notify} reload={load} />}
      {tab === 'profile' && <Profile data={data} notify={notify} reload={load} />}

      {toast && (
        <div className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 font-bold shadow-xl ${toast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-brand text-white'}`}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}

function CopyField({ label, value, hint }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input readOnly dir="ltr" className="input font-mono text-sm" value={value} onFocus={(e) => e.target.select()} />
        <button onClick={copy} className="btn-ghost shrink-0">{copied ? 'تم ✓' : 'نسخ'}</button>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${accent || ''}`}>{value}</p>
    </div>
  );
}

// ---------------- نظرة عامة ----------------
function Overview({ data, notify, reload }) {
  const { stats, urls, config } = data;
  const [overlayUrl, setOverlayUrl] = useState(urls.overlay);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOverlayUrl(urls.overlay), [urls.overlay]);

  async function regenerate() {
    if (!window.confirm('سيتوقف رابط التنبيه الحالي فوراً وعليك تحديثه في OBS/TikTok Studio. متابعة؟')) return;
    setBusy(true);
    const r = await api('/api/dashboard/regenerate-token', 'POST', {});
    setBusy(false);
    if (r.ok) {
      setOverlayUrl(r.data.overlayUrl);
      notify('تم إنشاء رابط تنبيه جديد');
      reload();
    } else notify('فشل التغيير', 'err');
  }

  async function testAlert() {
    const r = await api('/api/dashboard/test-alert', 'POST', {});
    if (r.ok && r.data.ok) notify('أُرسل تنبيه تجريبي إلى البث');
    else notify(r.data.error || 'تعذّر الإرسال، تأكد أن صفحة التنبيه مفتوحة في OBS', 'err');
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="الرصيد المتاح" value={`${fmt(stats.balance)} د.ع`} accent="text-gold" />
        <Stat label="إجمالي الأرباح" value={`${fmt(stats.totalEarned)} د.ع`} />
        <Stat label="عدد التبرعات" value={fmt(stats.donationCount)} />
        <Stat label="سحوبات قيد المعالجة" value={`${fmt(stats.pendingPayouts)} د.ع`} />
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-bold">روابطك</h2>
        <CopyField label="رابط صفحة التبرع (ضعه في البايو ووصف البث)" value={urls.donate} />
        <CopyField label="رابط التنبيه (سري — لا تشاركه مع أحد)" value={overlayUrl}
          hint="OBS: أضف مصدر Browser والصق الرابط (العرض 1920 والارتفاع 1080). TikTok LIVE Studio: أضف مصدراً من نوع رابط/Link." />
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost btn-sm" href={`${overlayUrl}?demo=1`} target="_blank" rel="noreferrer">معاينة التنبيه (تجريبي)</a>
          <button className="btn-ghost btn-sm" onClick={testAlert}>إرسال تنبيه تجريبي إلى البث</button>
          <button className="btn-ghost btn-sm text-brand" onClick={regenerate} disabled={busy}>تغيير رابط التنبيه</button>
        </div>
      </div>

      <div className="card text-sm text-slate-400">
        تُقتطع عمولة المنصة <b className="text-slate-200">{config.feePercent}%</b> من كل تبرع، ويُضاف
        الباقي <b className="text-slate-200">{100 - config.feePercent}%</b> إلى رصيدك تلقائياً بعد نجاح الدفع.
      </div>
    </div>
  );
}

// ---------------- التبرعات ----------------
function Donations({ data }) {
  if (data.donations.length === 0) {
    return <div className="card text-center text-slate-400">لا توجد تبرعات بعد. شارك رابط صفحتك في بثك.</div>;
  }
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-right text-sm">
        <thead className="border-b border-line text-slate-400">
          <tr>
            <th className="p-3">المتبرع</th>
            <th className="p-3">الرسالة</th>
            <th className="p-3">المبلغ</th>
            <th className="p-3">حصتك</th>
            <th className="p-3">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {data.donations.map((d) => (
            <tr key={d.id} className="border-b border-line/60 last:border-0">
              <td className="p-3 font-bold">{d.donorName}</td>
              <td className="max-w-[260px] truncate p-3 text-slate-300">{d.message || '—'}</td>
              <td className="p-3">{fmt(d.amount)}</td>
              <td className="p-3 font-bold text-gold">{fmt(d.creatorAmount)}</td>
              <td className="p-3 text-slate-400">{fmtDate(d.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- السحب ----------------
function Payouts({ data, notify, reload }) {
  const { stats, config, payouts } = data;
  const [form, setForm] = useState({ amount: '', method: config.payoutMethods[0].value, accountInfo: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/dashboard/payouts', 'POST', { ...form, amount: Number(form.amount) });
    setBusy(false);
    if (r.ok) {
      notify('تم إرسال طلب السحب');
      setForm({ ...form, amount: '', accountInfo: '' });
      reload();
    } else notify(r.data.error || 'فشل الطلب', 'err');
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card space-y-4">
        <h2 className="text-lg font-bold">طلب سحب</h2>
        <p className="text-sm text-slate-400">
          رصيدك المتاح <b className="text-gold">{fmt(stats.balance)} د.ع</b> — الحد الأدنى للسحب {fmt(config.minPayout)} د.ع
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pamount">المبلغ (د.ع)</label>
            <input id="pamount" type="number" dir="ltr" required min={config.minPayout} max={stats.balance} className="input"
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="pmethod">وسيلة الاستلام</label>
            <select id="pmethod" className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {config.payoutMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="pacc">رقم المحفظة / الحساب / IBAN</label>
          <input id="pacc" dir="ltr" required minLength={5} maxLength={120} className="input"
            value={form.accountInfo} onChange={(e) => setForm({ ...form, accountInfo: e.target.value })} />
        </div>
        <button className="btn-primary" disabled={busy || stats.balance < config.minPayout}>{busy ? 'جارٍ الإرسال...' : 'إرسال الطلب'}</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-line text-slate-400">
            <tr><th className="p-3">المبلغ</th><th className="p-3">الوسيلة</th><th className="p-3">الحالة</th><th className="p-3">التاريخ</th><th className="p-3">ملاحظة</th></tr>
          </thead>
          <tbody>
            {payouts.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">لا توجد طلبات سحب</td></tr>}
            {payouts.map((p) => {
              const st = PAYOUT_STATUS[p.status];
              return (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="p-3 font-bold">{fmt(p.amount)}</td>
                  <td className="p-3">{(config.payoutMethods.find((m) => m.value === p.method) || {}).label || p.method}</td>
                  <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                  <td className="p-3 text-slate-400">{fmtDate(p.createdAt)}</td>
                  <td className="p-3 text-slate-400">{p.adminNote || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- إعدادات التنبيه ----------------
function AlertSettings({ data, notify, reload }) {
  const [s, setS] = useState({ ...data.settings, soundUrl: data.settings.soundUrl || '', bannedText: (data.settings.bannedWords || []).join('، ') });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const bannedWords = s.bannedText.split(/[,،\n]/).map((w) => w.trim()).filter(Boolean);
    const body = {
      minAlertAmount: Number(s.minAlertAmount),
      durationMs: Number(s.durationMs),
      animation: s.animation,
      primaryColor: s.primaryColor,
      textColor: s.textColor,
      titleTemplate: s.titleTemplate,
      showMessage: s.showMessage,
      soundUrl: s.soundUrl,
      soundVolume: Number(s.soundVolume),
      ttsEnabled: s.ttsEnabled,
      bannedWords,
    };
    const r = await api('/api/dashboard/settings', 'PUT', body);
    setBusy(false);
    if (r.ok) {
      notify('تم حفظ الإعدادات');
      reload();
    } else notify(r.data.error || 'فشل الحفظ', 'err');
  }

  return (
    <form onSubmit={save} className="card space-y-5">
      <h2 className="text-lg font-bold">شكل وصوت التنبيه</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">الحد الأدنى لإظهار التنبيه (د.ع)</label>
          <input type="number" dir="ltr" className="input" min={0} value={s.minAlertAmount} onChange={(e) => set('minAlertAmount', e.target.value)} />
        </div>
        <div>
          <label className="label">مدة التنبيه (بالثواني)</label>
          <input type="number" dir="ltr" className="input" min={3} max={20} value={Math.round(s.durationMs / 1000)} onChange={(e) => set('durationMs', Number(e.target.value) * 1000)} />
        </div>
        <div>
          <label className="label">نوع الحركة</label>
          <select className="input" value={s.animation} onChange={(e) => set('animation', e.target.value)}>
            <option value="bounce">ارتداد</option>
            <option value="slide">انزلاق</option>
            <option value="zoom">تكبير</option>
            <option value="flip">قلب</option>
          </select>
        </div>
        <div>
          <label className="label">مستوى الصوت ({s.soundVolume}%)</label>
          <input type="range" min={0} max={100} className="w-full accent-[#FE2C55]" value={s.soundVolume} onChange={(e) => set('soundVolume', e.target.value)} />
        </div>
        <div>
          <label className="label">اللون الأساسي</label>
          <input type="color" className="h-12 w-full cursor-pointer rounded-xl border border-line bg-panel2 p-1" value={s.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
        </div>
        <div>
          <label className="label">لون النص</label>
          <input type="color" className="h-12 w-full cursor-pointer rounded-xl border border-line bg-panel2 p-1" value={s.textColor} onChange={(e) => set('textColor', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">نص العنوان (استخدم {'{name}'} للاسم و{'{amount}'} للمبلغ)</label>
        <input className="input" maxLength={120} value={s.titleTemplate} onChange={(e) => set('titleTemplate', e.target.value)} />
      </div>

      <div>
        <label className="label">رابط ملف صوت مخصص (https، اختياري — فارغ = نغمة مدمجة)</label>
        <input dir="ltr" className="input" placeholder="https://.../alert.mp3" value={s.soundUrl} onChange={(e) => set('soundUrl', e.target.value)} />
      </div>

      <div>
        <label className="label">كلمات ممنوعة (تُستبدل بـ *** في الاسم والرسالة، افصل بفاصلة)</label>
        <input className="input" value={s.bannedText} onChange={(e) => set('bannedText', e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#FE2C55]" checked={s.showMessage} onChange={(e) => set('showMessage', e.target.checked)} /> إظهار رسالة المتبرع</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#FE2C55]" checked={s.ttsEnabled} onChange={(e) => set('ttsEnabled', e.target.checked)} /> قراءة الرسالة بصوت المتصفح</label>
      </div>

      <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>
    </form>
  );
}

// ---------------- الملف الشخصي ----------------
function Profile({ data, notify, reload }) {
  const c = data.creator;
  const [f, setF] = useState({
    displayName: c.displayName,
    bio: c.bio || '',
    avatarUrl: c.avatarUrl || '',
    tiktokHandle: c.tiktokHandle || '',
    minDonation: c.minDonation,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/dashboard/profile', 'PUT', { ...f, minDonation: Number(f.minDonation) });
    setBusy(false);
    if (r.ok) {
      notify('تم حفظ الملف الشخصي');
      reload();
    } else notify(r.data.error || 'فشل الحفظ', 'err');
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="text-lg font-bold">الملف الشخصي (يظهر في صفحة التبرع)</h2>
      <div>
        <label className="label">الاسم الظاهر</label>
        <input className="input" required maxLength={40} value={f.displayName} onChange={set('displayName')} />
      </div>
      <div>
        <label className="label">نبذة قصيرة</label>
        <textarea className="input min-h-[80px] resize-none" maxLength={160} value={f.bio} onChange={set('bio')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">رابط الصورة (https)</label>
          <input dir="ltr" className="input" value={f.avatarUrl} onChange={set('avatarUrl')} placeholder="https://..." />
        </div>
        <div>
          <label className="label">معرّف تيك توك</label>
          <input dir="ltr" className="input" value={f.tiktokHandle} onChange={set('tiktokHandle')} placeholder="@username" />
        </div>
      </div>
      <div>
        <label className="label">أقل مبلغ تبرع (د.ع)</label>
        <input type="number" dir="ltr" className="input" value={f.minDonation} onChange={set('minDonation')} />
      </div>
      <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button>
    </form>
  );
}
