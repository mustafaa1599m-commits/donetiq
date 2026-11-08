// بوابة ZainCash (واجهة v2).
// المرجع: https://docs.zaincash.iq/
// - المصادقة: POST /oauth2/token (client_credentials + scope)
// - إنشاء العملية: POST /api/v2/payment-gateway/transaction/init => redirectUrl نحوّل المتبرع إليه
// - الاستعلام: GET /api/v2/payment-gateway/transaction/inquiry/{transactionId}
// - الـ Webhook: POST بالجسم {webhook_token: JWT} موقّع HS256 بمفتاح الـ API (يعمل في الإنتاج فقط
//   وبعد تسجيل الرابط لدى فريق ZainCash). الرجوع من الصفحة: successUrl?token=JWT.
//
// تنبيه: التوثيق العام لا يعرض كامل شكل الاستجابات ولا وحدة amount.value، لذلك:
//  1) نقرأ transactionId / redirectUrl من الاستجابة بعدة أسماء محتملة ونسجّل مفاتيح الاستجابة عند الفشل.
//  2) نرسل المبلغ بالدينار الكامل (IQD). تحقق من هذا في بيئة UAT قبل الإنتاج.
//  3) لا نثق أبداً بالـ webhook أو بالرجوع وحدهما: نتحقق دائماً بالاستعلام (inquiry) من الخادم.
import { randomUUID } from 'crypto';
import { jwtVerify } from 'jose';
import { config } from '../config';

const baseUrl = () => (process.env.ZAINCASH_BASE_URL || 'https://pg-api-uat.zaincash.iq').replace(/\/$/, '');

let cached = { token: null, exp: 0 };

export function isConfigured() {
  return Boolean(
    process.env.ZAINCASH_CLIENT_ID &&
      process.env.ZAINCASH_CLIENT_SECRET &&
      process.env.ZAINCASH_SERVICE_TYPE
  );
}

async function getToken() {
  if (cached.token && Date.now() < cached.exp) return cached.token;

  const res = await fetch(`${baseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ZAINCASH_CLIENT_ID,
      client_secret: process.env.ZAINCASH_CLIENT_SECRET,
      scope: 'payment:read payment:write',
    }),
  });
  if (!res.ok) throw new Error(`ZainCash auth failed: HTTP ${res.status}`);

  const data = await res.json();
  if (!data.access_token) throw new Error('ZainCash auth: no access_token in response');
  const ttl = Math.max(10, Number(data.expires_in || 300) - 30);
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

const pick = (obj, ...keys) => {
  for (const k of keys) {
    const v = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

// التحقق من توقيع JWT القادم من ZainCash (webhook أو الرجوع). يعيد الـ payload أو يرمي خطأ.
export async function verifyZainCashToken(token) {
  const key = process.env.ZAINCASH_API_KEY;
  if (!key) throw new Error('ZAINCASH_API_KEY is not set');
  const { payload } = await jwtVerify(token, new TextEncoder().encode(key), { algorithms: ['HS256'] });
  return payload;
}

export const zaincash = {
  name: 'ZAINCASH',
  label: 'زين كاش',
  isConfigured,

  async createPayment({ donation }) {
    const externalReferenceId = randomUUID();

    const res = await api('/api/v2/payment-gateway/transaction/init', {
      method: 'POST',
      body: JSON.stringify({
        language: 'Ar',
        externalReferenceId,
        orderId: donation.id,
        serviceType: process.env.ZAINCASH_SERVICE_TYPE,
        amount: { value: String(donation.amount), currency: 'IQD' },
        redirectUrls: {
          successUrl: `${config.appUrl}/pay/return/${donation.id}`,
          failureUrl: `${config.appUrl}/pay/return/${donation.id}`,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`ZainCash init failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    }

    const d = await res.json();
    const transactionId = pick(d, 'transactionId', 'data.transactionId', 'id', 'data.id');
    const redirectUrl = pick(d, 'redirectUrl', 'data.redirectUrl');
    if (!transactionId || !redirectUrl) {
      throw new Error(`ZainCash init: unexpected response keys [${Object.keys(d || {}).join(', ')}]`);
    }

    return {
      paymentId: String(transactionId),
      ref: externalReferenceId,
      expiresAt: null,
      action: { type: 'redirect', url: String(redirectUrl) },
    };
  },

  async checkStatus(donation) {
    const res = await api(
      `/api/v2/payment-gateway/transaction/inquiry/${encodeURIComponent(donation.gatewayPaymentId)}`
    );
    if (!res.ok) throw new Error(`ZainCash inquiry failed: HTTP ${res.status}`);
    const d = await res.json();
    const status = String(pick(d, 'status', 'data.status') || '').toUpperCase();

    if (status === 'SUCCESS') return { status: 'PAID', amount: null };
    if (status === 'FAILED') return { status: 'FAILED' };
    if (status === 'EXPIRED') return { status: 'EXPIRED' };
    return { status: 'PENDING' }; // PENDING / OTP_SENT / CUSTOMER_AUTHENTICATION_REQUIRED
  },
};
