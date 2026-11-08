// إرسال أحداث فورية إلى غرفة التنبيه عبر Socket.io (يعمل فقط مع server.js المخصص).
// على Vercel لا يوجد io، فتعتمد صفحة التنبيه على الـ polling تلقائياً.
export function emitToOverlay(overlayToken, event, payload) {
  const io = globalThis.__io;
  if (!io) return false;
  io.to(`overlay:${overlayToken}`).emit(event, payload);
  return true;
}
