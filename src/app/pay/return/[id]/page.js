'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// صفحة الرجوع من بوابة الدفع (ZainCash). لا نثق بما في الرابط: نسأل الخادم عن الحالة الفعلية.
export default function ReturnPage({ params }) {
  const [state, setState] = useState({ status: 'PENDING', creator: null, amount: 0 });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let stop = false;
    let n = 0;
    const tick = async () => {
      if (stop) return;
      n += 1;
      setTries(n);
      try {
        const res = await fetch(`/api/donations/${params.id}`, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          setState(d);
          if (d.status !== 'PENDING') return;
        }
      } catch {
        /* نعيد المحاولة */
      }
      if (n < 40) setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [params.id]);

  const back = state.creator ? `/donate/${state.creator.username}` : '/';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <div className="card text-center">
        {state.status === 'PAID' && (
          <>
            <div className="mb-3 text-5xl">🎉</div>
            <h1 className="mb-1 text-xl font-bold">تم الدفع بنجاح، شكراً لك!</h1>
            <p className="mb-5 text-slate-400">
              ظهر تبرعك على بث {state.creator ? state.creator.displayName : 'الصانع'}.
            </p>
          </>
        )}
        {state.status === 'PENDING' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-line border-t-aqua" />
            <h1 className="mb-1 text-xl font-bold">جارٍ التحقق من الدفع...</h1>
            <p className="mb-5 text-slate-400">
              {tries >= 40 ? 'تأخر التأكيد. إن كان المبلغ قد خُصم فسيظهر التبرع تلقائياً خلال دقائق.' : 'لا تغلق هذه الصفحة.'}
            </p>
          </>
        )}
        {(state.status === 'FAILED' || state.status === 'EXPIRED') && (
          <>
            <div className="mb-3 text-5xl">⚠️</div>
            <h1 className="mb-1 text-xl font-bold">لم تكتمل عملية الدفع</h1>
            <p className="mb-5 text-slate-400">لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى.</p>
          </>
        )}
        <Link href={back} className="btn-primary">العودة لصفحة التبرع</Link>
      </div>
    </main>
  );
}
