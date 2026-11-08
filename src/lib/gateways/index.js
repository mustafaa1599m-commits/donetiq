import { fib } from './fib';
import { zaincash } from './zaincash';
import { mock } from './mock';

// لإضافة بوابة جديدة (مثل Qi Card): أنشئ ملفاً يصدّر كائناً بنفس الواجهة
//   { name, label, isConfigured(), createPayment({donation, creator}), checkStatus(donation) }
// ثم أضفه هنا وأضف اسمه إلى enum Gateway في prisma/schema.prisma.
const ALL = { FIB: fib, ZAINCASH: zaincash, MOCK: mock };

export function getGateway(name) {
  const gw = ALL[name];
  if (!gw) throw new Error(`Unknown gateway: ${name}`);
  return gw;
}

// البوابات المفعّلة فعلياً (التي ضُبطت مفاتيحها) لعرضها في صفحة التبرع
export function enabledGateways() {
  return Object.values(ALL)
    .filter((g) => g.isConfigured())
    .map((g) => ({ name: g.name, label: g.label }));
}

export function isGatewayEnabled(name) {
  return enabledGateways().some((g) => g.name === name);
}
