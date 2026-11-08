'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const DEFAULTS = {
  minAlertAmount: 1000,
  durationMs: 8000,
  animation: 'bounce',
  primaryColor: '#FFD400',
  textColor: '#FFFFFF',
  titleTemplate: '{name} تبرّع بـ {amount}',
  showMessage: true,
  soundUrl: null,
  soundVolume: 80,
  ttsEnabled: false,
  bannedWords: [],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Number(n).toLocaleString('en-US');
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mask(text, words) {
  let out = text || '';
  for (const w of words || []) {
    if (!w) continue;
    out = out.replace(new RegExp(escapeRegExp(w), 'gi'), '***');
  }
  return out;
}

// عرض القالب كعناصر React (بدون innerHTML) لمنع حقن HTML من أسماء المتبرعين
function renderTitle(template, name, amount, color, textColor) {
  const parts = template.split(/(\{name\}|\{amount\})/g);
  return parts.map((p, i) => {
    if (p === '{name}') return <span key={i} style={{ color }} className="font-extrabold">{name}</span>;
    if (p === '{amount}') return <span key={i} style={{ color }} className="font-extrabold">{amount}</span>;
    return <span key={i} style={{ color: textColor }}>{p}</span>;
  });
}

// ---- صوت: نغمة مدمجة عبر WebAudio، أو ملف المستخدم ----
function playChime(ctx, volume) {
  const notes = [659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.11;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume * 0.45, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  });
}

// ---- قصاصات ملونة على canvas ----
function burst(canvas, colors) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth);
  const h = (canvas.height = canvas.clientHeight);
  const parts = Array.from({ length: 110 }, () => ({
    x: w / 2,
    y: h * 0.32,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 13 - 4,
    s: 6 + Math.random() * 7,
    r: Math.random() * 6.28,
    vr: (Math.random() - 0.5) * 0.45,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const tick = (t) => {
    const age = t - start;
    ctx.clearRect(0, 0, w, h);
    if (age > 2400) return;
    for (const p of parts) {
      p.vy += 0.38;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 2400);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const DEMO_ALERTS = [
  { name: 'أحمد', amount: 5000, message: 'استمر يا بطل! بثك رائع 🔥' },
  { name: 'سارة', amount: 25000, message: 'تحية من البصرة ❤️' },
  { name: 'علي', amount: 10000, message: '' },
];

export default function OverlayClient({ token, demo, debug }) {
  const [current, setCurrent] = useState(null); // { alert, phase }
  const [conn, setConn] = useState('connecting');
  const [needsClick, setNeedsClick] = useState(false);

  const configRef = useRef(DEFAULTS);
  const queueRef = useRef([]);
  const seenRef = useRef(new Set());
  const busyRef = useRef(false);
  const audioCtxRef = useRef(null);
  const canvasRef = useRef(null);

  // خلفية شفافة تماماً لتظهر فوق البث
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/overlay/${token}/config`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        configRef.current = { ...DEFAULTS, ...d.settings };
      }
    } catch {
      /* نبقي آخر إعدادات */
    }
  }, [token]);

  const ack = useCallback(
    (ids) => {
      fetch(`/api/overlay/${token}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch(() => {});
    },
    [token]
  );

  const ensureAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => setNeedsClick(false)).catch(() => setNeedsClick(true));
        if (ctx.state === 'suspended') setNeedsClick(true);
      }
    } catch {
      /* لا صوت */
    }
  }, []);

  const playSound = useCallback(
    (cfg) => {
      const vol = Math.max(0, Math.min(1, cfg.soundVolume / 100));
      if (vol === 0) return;
      try {
        if (cfg.soundUrl) {
          const a = new Audio(cfg.soundUrl);
          a.volume = vol;
          a.play().catch(() => setNeedsClick(true));
        } else {
          ensureAudio();
          if (audioCtxRef.current) playChime(audioCtxRef.current, vol);
        }
      } catch {
        /* ignore */
      }
    },
    [ensureAudio]
  );

  const speak = useCallback((cfg, alert) => {
    if (!cfg.ttsEnabled || !alert.message || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const text = `${alert.name}. ${mask(alert.message, cfg.bannedWords)}`;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      u.volume = Math.max(0, Math.min(1, cfg.soundVolume / 100));
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }, []);

  // مشغّل الطابور: ينفّذ تنبيهاً واحداً في كل مرة
  const pump = useCallback(async () => {
    if (busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;

    const cfg = configRef.current;
    setCurrent({ alert: next, phase: 'in' });
    playSound(cfg);
    speak(cfg, next);
    burst(canvasRef.current, [cfg.primaryColor, '#25F4EE', '#FE2C55', '#FFFFFF']);

    await sleep(cfg.durationMs);
    setCurrent((c) => (c ? { ...c, phase: 'out' } : c));
    await sleep(700);
    setCurrent(null);

    if (!next.test && !next.demo) ack([next.id]);
    busyRef.current = false;
    await sleep(500);
    pump();
  }, [ack, playSound, speak]);

  const enqueue = useCallback(
    (alert) => {
      if (!alert || !alert.id || seenRef.current.has(alert.id)) return;
      seenRef.current.add(alert.id);
      if (seenRef.current.size > 500) seenRef.current.clear();
      queueRef.current.push(alert);
      pump();
    },
    [pump]
  );

  // الاتصال: Socket.io للفورية + polling كشبكة أمان (يعمل وحده على Vercel)
  useEffect(() => {
    let alive = true;
    loadConfig();
    const cfgTimer = setInterval(loadConfig, 60000);

    let socket = null;
    if (!demo) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || undefined, {
        transports: ['websocket', 'polling'],
        reconnectionDelayMax: 30000,
      });
      socket.on('connect', () => {
        socket.emit('join', token, (res) => {
          if (alive) setConn(res && res.ok ? 'live' : 'invalid-token');
        });
      });
      socket.on('disconnect', () => alive && setConn('polling'));
      socket.on('connect_error', () => alive && setConn('polling'));
      socket.on('alert', (a) => enqueue(a));
      socket.on('config-updated', loadConfig);
    }

    const poll = async () => {
      if (demo) return;
      try {
        const res = await fetch(`/api/overlay/${token}/pending`, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          (d.alerts || []).forEach(enqueue);
        } else if (res.status === 404) {
          setConn('invalid-token');
        }
      } catch {
        /* نعيد المحاولة في الدورة التالية */
      }
    };
    poll();
    const pollTimer = setInterval(poll, 2500);

    let demoTimer = null;
    let demoFirst = null;
    if (demo) {
      setConn('demo');
      let i = 0;
      const fire = () => {
        const d = DEMO_ALERTS[i % DEMO_ALERTS.length];
        i += 1;
        enqueue({ id: `demo-${Date.now()}-${i}`, ...d, demo: true, paidAt: new Date().toISOString() });
      };
      demoFirst = setTimeout(fire, 800);
      demoTimer = setInterval(fire, 9000);
    }

    return () => {
      alive = false;
      clearInterval(cfgTimer);
      clearInterval(pollTimer);
      if (demoTimer) clearInterval(demoTimer);
      if (demoFirst) clearTimeout(demoFirst);
      if (socket) socket.disconnect();
    };
  }, [token, demo, enqueue, loadConfig]);

  const cfg = configRef.current;
  const a = current ? current.alert : null;
  const animClass = current ? `anim-${cfg.animation}-${current.phase}` : '';
  const name = a ? mask(a.name, cfg.bannedWords) : '';
  const message = a ? mask(a.message, cfg.bannedWords) : '';

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      dir="rtl"
      onClick={ensureAudio}
      style={{ background: 'transparent' }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {a && (
        <div className="absolute inset-x-0 top-[8%] flex justify-center px-6">
          {/* الغلاف الخارجي للدخول/الخروج، والداخلي للتوهج (لا يمكن دمجهما: كلاهما يستخدم خاصية animation) */}
          <div className={`${animClass} max-w-[88%]`}>
            <div
              className="glow rounded-3xl px-10 py-7 text-center"
              style={{
                '--glow': `${cfg.primaryColor}99`,
                background: 'linear-gradient(135deg, rgba(10,13,20,0.93), rgba(26,33,51,0.93))',
                border: `3px solid ${cfg.primaryColor}`,
                minWidth: 520,
              }}
            >
              <div className="text-4xl leading-snug">
                {renderTitle(cfg.titleTemplate, name, `${fmt(a.amount)} د.ع`, cfg.primaryColor, cfg.textColor)}
              </div>
              <div
                className="pop-amount mx-auto mt-3 inline-block rounded-full px-8 py-2 text-5xl font-extrabold"
                style={{ background: cfg.primaryColor, color: '#0A0D14' }}
              >
                {fmt(a.amount)} د.ع
              </div>
              {cfg.showMessage && message && (
                <p className="mx-auto mt-4 max-w-[900px] break-words text-3xl" style={{ color: cfg.textColor }}>
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {(debug || needsClick) && (
        <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white" dir="ltr">
          {debug && <span>status: {conn} </span>}
          {needsClick && <span>click once to enable sound</span>}
        </div>
      )}
    </div>
  );
}
