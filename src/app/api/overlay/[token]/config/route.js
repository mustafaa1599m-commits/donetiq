import { prisma } from '@/lib/prisma';
import { json, clientIp } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// ملاحظة: ملفات route.js في Next لا يجوز أن تصدّر شيئاً غير handlers والإعدادات، لذلك الثابت غير مُصدَّر.
const DEFAULT_SETTINGS = {
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

// إعدادات التنبيه لصفحة البث. الرمز السري هو "كلمة المرور" الوحيدة، لذلك لا نعيد أي بيانات حساسة.
export async function GET(req, { params }) {
  if (!rateLimit(`ovcfg:${clientIp(req)}`, 60, 60 * 1000)) return json({ error: 'rate limited' }, 429);

  const creator = await prisma.creator.findUnique({
    where: { overlayToken: params.token },
    select: { displayName: true, alertSettings: true },
  });
  if (!creator) return json({ error: 'not found' }, 404);

  const s = creator.alertSettings || DEFAULT_SETTINGS;
  return json({
    displayName: creator.displayName,
    settings: {
      minAlertAmount: s.minAlertAmount,
      durationMs: s.durationMs,
      animation: s.animation,
      primaryColor: s.primaryColor,
      textColor: s.textColor,
      titleTemplate: s.titleTemplate,
      showMessage: s.showMessage,
      soundUrl: s.soundUrl,
      soundVolume: s.soundVolume,
      ttsEnabled: s.ttsEnabled,
      bannedWords: s.bannedWords,
    },
  });
}
