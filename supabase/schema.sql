-- ============================================================
-- Donatiq - مخطط PostgreSQL كامل (يطابق prisma/schema.prisma مع قيدين إضافيين:
--   رصيد غير سالب، ومجموع حصة المنصة + الصانع = المبلغ)
-- الاستخدام: الصقه في Supabase > SQL Editor ثم Run.
-- البديل: npx prisma db push  (ثم شغّل supabase/rls.sql)
-- لا تستخدم الطريقتين معاً على نفس القاعدة.
-- ============================================================

CREATE TYPE "Role" AS ENUM ('CREATOR', 'ADMIN');
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED');
CREATE TYPE "Gateway" AS ENUM ('MOCK', 'FIB', 'ZAINCASH');

-- ---------------- User ----------------
CREATE TABLE "User" (
  "id"           TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role"         "Role" NOT NULL DEFAULT 'CREATOR',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- ---------------- Creator ----------------
CREATE TABLE "Creator" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "username"     TEXT NOT NULL,
  "displayName"  TEXT NOT NULL,
  "bio"          TEXT,
  "avatarUrl"    TEXT,
  "tiktokHandle" TEXT,
  "overlayToken" TEXT NOT NULL,
  "balance"      INTEGER NOT NULL DEFAULT 0,
  "totalEarned"  INTEGER NOT NULL DEFAULT 0,
  "minDonation"  INTEGER NOT NULL DEFAULT 1000,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Creator_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Creator_balance_nonneg" CHECK ("balance" >= 0)
);
CREATE UNIQUE INDEX "Creator_userId_key" ON "Creator"("userId");
CREATE UNIQUE INDEX "Creator_username_key" ON "Creator"("username");
CREATE UNIQUE INDEX "Creator_overlayToken_key" ON "Creator"("overlayToken");

-- ---------------- Donation ----------------
CREATE TABLE "Donation" (
  "id"               TEXT NOT NULL,
  "creatorId"        TEXT NOT NULL,
  "donorName"        TEXT NOT NULL,
  "message"          TEXT,
  "amount"           INTEGER NOT NULL,
  "feePercent"       INTEGER NOT NULL,
  "platformFee"      INTEGER NOT NULL,
  "creatorAmount"    INTEGER NOT NULL,
  "status"           "DonationStatus" NOT NULL DEFAULT 'PENDING',
  "gateway"          "Gateway" NOT NULL,
  "gatewayPaymentId" TEXT,
  "gatewayRef"       TEXT,
  "checkoutUrl"      TEXT,
  "expiresAt"        TIMESTAMP(3),
  "paidAt"           TIMESTAMP(3),
  "alertAckedAt"     TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Donation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Donation_split_ok" CHECK ("platformFee" + "creatorAmount" = "amount")
);
CREATE UNIQUE INDEX "Donation_gateway_gatewayPaymentId_key" ON "Donation"("gateway", "gatewayPaymentId");
CREATE INDEX "Donation_creatorId_status_createdAt_idx" ON "Donation"("creatorId", "status", "createdAt");
CREATE INDEX "Donation_creatorId_status_alertAckedAt_paidAt_idx" ON "Donation"("creatorId", "status", "alertAckedAt", "paidAt");

-- ---------------- Payout ----------------
CREATE TABLE "Payout" (
  "id"          TEXT NOT NULL,
  "creatorId"   TEXT NOT NULL,
  "amount"      INTEGER NOT NULL,
  "method"      TEXT NOT NULL,
  "accountInfo" TEXT NOT NULL,
  "status"      "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "adminNote"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payout_creatorId_createdAt_idx" ON "Payout"("creatorId", "createdAt");
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");

-- ---------------- AlertSettings ----------------
CREATE TABLE "AlertSettings" (
  "id"             TEXT NOT NULL,
  "creatorId"      TEXT NOT NULL,
  "minAlertAmount" INTEGER NOT NULL DEFAULT 1000,
  "durationMs"     INTEGER NOT NULL DEFAULT 8000,
  "animation"      TEXT NOT NULL DEFAULT 'bounce',
  "primaryColor"   TEXT NOT NULL DEFAULT '#FFD400',
  "textColor"      TEXT NOT NULL DEFAULT '#FFFFFF',
  "titleTemplate"  TEXT NOT NULL DEFAULT '{name} تبرّع بـ {amount}',
  "showMessage"    BOOLEAN NOT NULL DEFAULT true,
  "soundUrl"       TEXT,
  "soundVolume"    INTEGER NOT NULL DEFAULT 80,
  "ttsEnabled"     BOOLEAN NOT NULL DEFAULT false,
  "bannedWords"    TEXT[] DEFAULT ARRAY[]::TEXT[],
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AlertSettings_creatorId_key" ON "AlertSettings"("creatorId");

-- ---------------- Foreign keys ----------------
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertSettings" ADD CONSTRAINT "AlertSettings_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------- RLS (أمان Supabase) ----------------
ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Creator"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Donation"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlertSettings" ENABLE ROW LEVEL SECURITY;
