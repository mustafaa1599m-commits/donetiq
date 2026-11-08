import { config, PAYOUT_METHODS } from './config';

// ---------- أدوات عامة ----------
// نزيل محارف التحكم ومحارف اتجاه النص الخفية (تُستخدم في الانتحال البصري) ونوحّد المسافات
const CONTROL_CHARS = /[\u0000-\u001F\u007F‎‏‪-‮⁦-⁩]/g;

export function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function isHttpsUrl(v, max = 300) {
  if (typeof v !== 'string' || v.length > max) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

export const isHexColor = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

function toInt(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\d{1,12}$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'dashboard', 'login', 'register', 'overlay', 'donate', 'pay',
  'logout', 'static', 'support', 'help', 'about', 'terms', 'privacy', 'root', 'null', 'undefined',
]);

const fail = (error) => ({ error });
const ok = (value) => ({ value });

// ---------- التسجيل ----------
export function validateRegister(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('البريد الإلكتروني غير صالح');

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8 || password.length > 72) return fail('كلمة المرور يجب أن تكون بين 8 و72 حرفاً');

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return fail('اسم المستخدم: 3-20 حرفاً إنجليزياً صغيراً أو أرقاماً أو _');
  if (RESERVED_USERNAMES.has(username)) return fail('اسم المستخدم محجوز، اختر اسماً آخر');

  const displayName = cleanText(body.displayName, 40);
  if (displayName.length < 2) return fail('الاسم الظاهر قصير جداً');

  return ok({ email, password, username, displayName });
}

// ---------- التبرع ----------
export function validateDonation(body) {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!username) return fail('صانع المحتوى غير محدد');

  const donorName = cleanText(body.donorName, 30) || 'فاعل خير';
  const message = cleanText(body.message, 150);

  const amount = toInt(body.amount);
  if (amount === null) return fail('المبلغ غير صالح');
  if (amount < config.minDonation) return fail(`أقل مبلغ للتبرع ${config.minDonation.toLocaleString('en-US')} د.ع`);
  if (amount > config.maxDonation) return fail(`أعلى مبلغ للتبرع ${config.maxDonation.toLocaleString('en-US')} د.ع`);

  const gateway = typeof body.gateway === 'string' ? body.gateway.toUpperCase() : '';
  if (!gateway) return fail('اختر وسيلة الدفع');

  return ok({ username, donorName, message, amount, gateway });
}

// ---------- الملف الشخصي ----------
export function validateProfile(body) {
  const out = {};

  if (body.displayName !== undefined) {
    const v = cleanText(body.displayName, 40);
    if (v.length < 2) return fail('الاسم الظاهر قصير جداً');
    out.displayName = v;
  }
  if (body.bio !== undefined) {
    out.bio = cleanText(body.bio, 160) || null;
  }
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === '' || body.avatarUrl === null) out.avatarUrl = null;
    else if (isHttpsUrl(body.avatarUrl)) out.avatarUrl = body.avatarUrl;
    else return fail('رابط الصورة يجب أن يبدأ بـ https://');
  }
  if (body.tiktokHandle !== undefined) {
    const v = cleanText(body.tiktokHandle, 30);
    if (v === '') out.tiktokHandle = null;
    else if (/^@?[A-Za-z0-9._]{2,24}$/.test(v)) out.tiktokHandle = v.replace(/^@/, '');
    else return fail('معرّف تيك توك غير صالح');
  }
  if (body.minDonation !== undefined) {
    const n = toInt(body.minDonation);
    if (n === null || n < config.minDonation || n > 1000000) {
      return fail(`الحد الأدنى للتبرع بين ${config.minDonation.toLocaleString('en-US')} و1,000,000`);
    }
    out.minDonation = n;
  }
  return ok(out);
}

// ---------- إعدادات التنبيه ----------
export const ANIMATIONS = ['bounce', 'slide', 'zoom', 'flip'];

export function validateAlertSettings(body) {
  const out = {};

  if (body.minAlertAmount !== undefined) {
    const n = toInt(body.minAlertAmount);
    if (n === null || n > 100000000) return fail('الحد الأدنى للتنبيه غير صالح');
    out.minAlertAmount = n;
  }
  if (body.durationMs !== undefined) {
    const n = toInt(body.durationMs);
    if (n === null || n < 3000 || n > 20000) return fail('مدة التنبيه بين 3 و20 ثانية');
    out.durationMs = n;
  }
  if (body.animation !== undefined) {
    if (!ANIMATIONS.includes(body.animation)) return fail('نوع الأنيميشن غير صالح');
    out.animation = body.animation;
  }
  if (body.primaryColor !== undefined) {
    if (!isHexColor(body.primaryColor)) return fail('اللون الأساسي غير صالح');
    out.primaryColor = body.primaryColor;
  }
  if (body.textColor !== undefined) {
    if (!isHexColor(body.textColor)) return fail('لون النص غير صالح');
    out.textColor = body.textColor;
  }
  if (body.titleTemplate !== undefined) {
    const v = cleanText(body.titleTemplate, 120);
    if (!v.includes('{name}')) return fail('قالب العنوان يجب أن يحتوي {name}');
    out.titleTemplate = v;
  }
  if (body.showMessage !== undefined) out.showMessage = Boolean(body.showMessage);
  if (body.ttsEnabled !== undefined) out.ttsEnabled = Boolean(body.ttsEnabled);
  if (body.soundVolume !== undefined) {
    const n = toInt(body.soundVolume);
    if (n === null || n > 100) return fail('مستوى الصوت بين 0 و100');
    out.soundVolume = n;
  }
  if (body.soundUrl !== undefined) {
    if (body.soundUrl === '' || body.soundUrl === null) out.soundUrl = null;
    else if (isHttpsUrl(body.soundUrl)) out.soundUrl = body.soundUrl;
    else return fail('رابط الصوت يجب أن يبدأ بـ https://');
  }
  if (body.bannedWords !== undefined) {
    if (!Array.isArray(body.bannedWords) || body.bannedWords.length > 50) return fail('قائمة الكلمات الممنوعة غير صالحة');
    out.bannedWords = [...new Set(body.bannedWords.map((w) => cleanText(w, 30).toLowerCase()).filter(Boolean))];
  }
  return ok(out);
}

// ---------- السحب ----------
export function validatePayout(body) {
  const amount = toInt(body.amount);
  if (amount === null || amount <= 0) return fail('مبلغ السحب غير صالح');

  const method = typeof body.method === 'string' ? body.method.toUpperCase() : '';
  if (!PAYOUT_METHODS.includes(method)) return fail('وسيلة السحب غير صالحة');

  const accountInfo = cleanText(body.accountInfo, 120);
  if (accountInfo.length < 5) return fail('أدخل بيانات الحساب/المحفظة بشكل صحيح');

  return ok({ amount, method, accountInfo });
}
