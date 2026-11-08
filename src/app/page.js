import Link from 'next/link';

export default function Home() {
  const steps = [
    { n: '1', t: 'أنشئ صفحتك', d: 'سجّل واحصل على رابط تبرع خاص بك مثل /donate/اسمك.' },
    { n: '2', t: 'ضع التنبيه في البث', d: 'انسخ رابط التنبيه وأضفه كـ Browser Source في OBS أو كمصدر رابط في TikTok LIVE Studio.' },
    { n: '3', t: 'استلم التبرعات', d: 'المتابع يدفع بالدينار العراقي، ويظهر اسمه ورسالته على شاشتك في نفس اللحظة.' },
  ];

  return (
    <main>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-2xl font-extrabold">
          Dona<span className="text-brand">tiq</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost btn-sm">دخول</Link>
          <Link href="/register" className="btn-primary btn-sm">إنشاء حساب</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-16 pt-14 text-center">
        <p className="mb-4 inline-block rounded-full border border-line bg-panel px-4 py-1 text-sm text-aqua">
          صُنع لصنّاع المحتوى في العراق
        </p>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
          حوّل بثك المباشر إلى
          <span className="block bg-gradient-to-l from-brand to-gold bg-clip-text text-transparent">
            مصدر دخل حقيقي
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
          صفحة تبرع برابط واحد، دفع بالدينار العراقي، وتنبيه فوري بالاسم والمبلغ والصوت على شاشة البث.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Link href="/register" className="btn-primary">ابدأ مجاناً</Link>
          <Link href="/donate/demo" className="btn-ghost">شاهد صفحة تجريبية</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-24 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-lg font-extrabold text-brand">
              {s.n}
            </div>
            <h3 className="mb-1 text-lg font-bold">{s.t}</h3>
            <p className="text-slate-400">{s.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
