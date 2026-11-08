/* تشغيل: npm run db:seed  — ينشئ حساب أدمن وصانع محتوى تجريبي (demo) */
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();
const newToken = () => crypto.randomBytes(24).toString('base64url');

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe12345';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: 'ADMIN',
    },
  });
  console.log(`Admin ready: ${adminEmail}`);

  const demoExists = await prisma.creator.findUnique({ where: { username: 'demo' } });
  if (!demoExists) {
    const user = await prisma.user.create({
      data: {
        email: 'demo@example.com',
        passwordHash: await bcrypt.hash('DemoPass12345', 12),
        role: 'CREATOR',
      },
    });
    const creator = await prisma.creator.create({
      data: {
        userId: user.id,
        username: 'demo',
        displayName: 'صانع تجريبي',
        bio: 'حساب تجريبي لاختبار صفحة التبرع والتنبيه.',
        overlayToken: newToken(),
        alertSettings: { create: {} },
      },
    });
    console.log('Demo creator: /donate/demo   (login: demo@example.com / DemoPass12345)');
    console.log(`Demo overlay token: ${creator.overlayToken}`);
  } else {
    console.log('Demo creator already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
