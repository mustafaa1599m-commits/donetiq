// تحديد معدل الطلبات بالذاكرة (نافذة منزلقة). يعمل لكل نسخة تشغيل (instance) على حدة.
const buckets = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v[v.length - 1] > 10 * 60 * 1000) buckets.delete(k);
    }
  }
  return true;
}
