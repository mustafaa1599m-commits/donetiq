// التقسيم التلقائي للعمولة. المجموع دائماً = المبلغ الأصلي بالضبط (لا يضيع دينار بسبب التقريب).
export function splitAmount(amount, feePercent) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive integer');
  if (!Number.isInteger(feePercent) || feePercent < 0 || feePercent > 100) {
    throw new Error('feePercent must be an integer 0-100');
  }
  const platformFee = Math.round((amount * feePercent) / 100);
  const creatorAmount = amount - platformFee;
  return { platformFee, creatorAmount };
}

export function formatIQD(n) {
  return `${Number(n).toLocaleString('en-US')} د.ع`;
}
