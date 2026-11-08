/* eslint-disable */
// ============================================================
// خادم مخصص: Next.js + Socket.io على نفس المنفذ.
// dev:   npm run dev
// prod:  npm start   (يعمل مع Render / VPS / Railway)
// ملاحظة: Vercel لا يدعم WebSocket دائم، لذلك صفحة التنبيه تملك بديلاً (polling).
// ============================================================
const prod = process.argv.includes('--prod');
if (prod) process.env.NODE_ENV = 'production';
else if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
const dev = process.env.NODE_ENV !== 'production';

const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd(), dev);

const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => handle(req, res));

    const io = new Server(httpServer, {
      cors: { origin: process.env.APP_URL ? [process.env.APP_URL.replace(/\/$/, '')] : true },
      destroyUpgrade: false, // لا نقطع اتصالات HMR الخاصة بـ Next في وضع التطوير
      pingInterval: 20000,
      pingTimeout: 25000,
    });

    io.on('connection', (socket) => {
      // صفحة التنبيه ترسل رمزها السري للانضمام إلى غرفة صانع المحتوى
      socket.on('join', async (token, ack) => {
        try {
          if (typeof token !== 'string' || token.length < 16 || token.length > 128) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
          }
          const creator = await prisma.creator.findUnique({
            where: { overlayToken: token },
            select: { id: true },
          });
          if (!creator) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
          }
          socket.join(`overlay:${token}`);
          if (typeof ack === 'function') ack({ ok: true });
        } catch (err) {
          console.error('[socket join]', err);
          if (typeof ack === 'function') ack({ ok: false });
        }
      });
    });

    // يُستخدم من مسارات الـ API لإرسال التنبيهات (src/lib/realtime.js)
    globalThis.__io = io;

    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`> Donatiq ready on port ${port} (${dev ? 'development' : 'production'})`);
    });

    const shutdown = async () => {
      console.log('Shutting down...');
      io.close();
      httpServer.close();
      await prisma.$disconnect();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
