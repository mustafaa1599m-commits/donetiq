// بوابة FIB (First Iraqi Bank) - الدفع عبر QR / تطبيق FIB.
// المرجع: https://fib.iq/developers/web-payment
// - المصادقة: OAuth2 client_credentials (التوكن قصير العمر ~60 ثانية فنخزّنه مؤقتاً)
// - إنشاء الدفع: POST /protected/v1/payments
// - حالة الدفع: GET  /protected/v1/payments/{id}/status  => PAID | UNPAID | DECLINED
// - الـ callback: POST إلى statusCallbackUrl بالجسم {id, status} ولا يحمل توقيعاً،
//   لذلك لا نثق به: نتحقق دائماً من الحالة عبر استدعاء status من الخادم إلى FIB.
import { config } from '../config';

const baseUrl = () => (process.env.FIB_BASE_URL || 'https://fib.stage.fib.iq').replace(/\/$/, '');
const authPath = () =>
  process.env.FIB_AUTH_PATH || '/auth/realms/fib-online-shop/protocol/openid-connect/token';

let cached = { token: null, exp: 0 };

export function isConfigured() {
  return Boolean(process.env.FIB_CLIENT_ID && process.env.FIB_CLIENT_SECRET && process.env.WEBHOOK_SECRET);
}

async function getToken() {
  if (cached.token && Date.now() < cached.exp) return cached.token;

  const res = await fetch(`${baseUrl()}${authPath()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.FIB_CLIENT_ID,
      client_secret: process.env.FIB_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`FIB auth failed: HTTP ${res.status}`);

  const data = await res.json();
  if (!data.access_token) throw new Error('FIB auth: no access_token in response');
  const ttl = Math.max(5, Number(data.expires_in || 60) - 10);
  cached = { token: data.access_token, exp: Date.now() + ttl * 1000 };
  return cached.token;
}

async function api(path, init = {}) {
  const token = await getToken();
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export const fib = {
  name: 'FIB',
  label: 'FIB - بنك العراق الأول',
  isConfigured,

  async createPayment({ donation, creator }) {
    const callback = `${config.appUrl}/api/webhooks/fib?secret=${encodeURIComponent(process.env.WEBHOOK_SECRET)}`;

    const res = await api('/protected/v1/payments', {
      method: 'POST',
      body: JSON.stringify({
        monetaryValue: { amount: `${donation.amount}.00`, currency: 'IQD' },
        statusCallbackUrl: callback,
        description: `Donation to ${creator.username}`.slice(0, 50),
      }),
    });
    if (!res.ok) {
      throw new Error(`FIB create payment failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    }

    const d = await res.json();
    if (!d.paymentId) throw new Error('FIB create payment: paymentId missing in response');

    return {
      paymentId: d.paymentId,
      ref: d.readableCode || null,
      expiresAt: d.validUntil ? new Date(d.validUntil) : null,
      action: {
        type: 'qr',
        qrCode: d.qrCode, // data URL (base64 image)
        readableCode: d.readableCode,
        links: {
          personal: d.personalAppLink || null,
          business: d.businessAppLink || null,
          corporate: d.corporateAppLink || null,
        },
        validUntil: d.validUntil || null,
      },
    };
  },

  // يعيد {status: PAID|PENDING|FAILED|EXPIRED, amount?}
  async checkStatus(donation) {
    const res = await api(`/protected/v1/payments/${encodeURIComponent(donation.gatewayPaymentId)}/status`);
    if (!res.ok) throw new Error(`FIB status failed: HTTP ${res.status}`);
    const d = await res.json();

    if (d.status === 'PAID') {
      const raw = d.amount && d.amount.amount;
      return { status: 'PAID', amount: raw != null ? Math.round(parseFloat(raw)) : null };
    }
    if (d.status === 'DECLINED') {
      return { status: d.decliningReason === 'PAYMENT_EXPIRATION' ? 'EXPIRED' : 'FAILED' };
    }
    return { status: 'PENDING' };
  },
};
