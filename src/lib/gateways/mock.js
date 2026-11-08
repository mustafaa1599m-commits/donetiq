// بوابة تجريبية لاختبار الدورة كاملة (دفع -> رصيد -> تنبيه) بدون أموال حقيقية.
// تعمل فقط عند ALLOW_MOCK_PAYMENTS=true. أوقفها في الإنتاج الفعلي.
import { config } from '../config';

export const mock = {
  name: 'MOCK',
  label: 'دفع تجريبي (للاختبار فقط)',

  isConfigured() {
    return config.allowMock;
  },

  async createPayment({ donation }) {
    return {
      paymentId: `mock_${donation.id}`,
      ref: null,
      expiresAt: null,
      action: { type: 'redirect', url: `${config.appUrl}/pay/mock/${donation.id}` },
    };
  },

  // الإتمام يتم عبر /api/pay/mock/[id] مباشرة، فلا يوجد استعلام خارجي
  async checkStatus() {
    return { status: 'PENDING' };
  },
};
