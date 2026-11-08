-- ============================================================
-- مهم أمنياً: Supabase يكشف جداول schema public عبر PostgREST بمفتاح anon.
-- تفعيل RLS بدون أي policy يمنع أي وصول عبر الـ API العام.
-- التطبيق يتصل بدور postgres عبر Prisma، وهذا الدور يتجاوز RLS، فلا يتأثر.
-- شغّل هذا الملف مرة واحدة في Supabase > SQL Editor بعد إنشاء الجداول.
-- ============================================================

ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Creator"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Donation"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlertSettings" ENABLE ROW LEVEL SECURITY;
