// إعدادات الأعمال من متغيرات البيئة (تُقرأ عند كل استخدام ليسهل تغييرها بدون إعادة بناء)

function intEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

export const config = {
  get appUrl() {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  },
  // نسبة عمولة المنصة (عدد صحيح 0-100). الافتراضي 30%.
  get feePercent() {
    return intEnv('PLATFORM_FEE_PERCENT', 30, 0, 100);
  },
  get minDonation() {
    return intEnv('MIN_DONATION_IQD', 1000, 500, 100000000);
  },
  get maxDonation() {
    return intEnv('MAX_DONATION_IQD', 5000000, 1000, 1000000000);
  },
  get minPayout() {
    return intEnv('MIN_PAYOUT_IQD', 25000, 1000, 1000000000);
  },
  get allowMock() {
    return process.env.ALLOW_MOCK_PAYMENTS === 'true';
  },
};

export const PAYOUT_METHODS = ['ZAINCASH', 'FIB', 'QICARD', 'BANK'];

export const PAYOUT_METHOD_LABELS = {
  ZAINCASH: 'زين كاش',
  FIB: 'FIB',
  QICARD: 'كي كارد',
  BANK: 'حساب مصرفي',
};
