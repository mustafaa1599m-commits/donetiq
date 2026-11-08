# Donatiq — منصة تبرعات لصنّاع المحتوى في العراق (TikTok Live)

صفحة تبرع لكل صانع محتوى → دفع بالدينار العراقي → تقسيم تلقائي للعمولة (30% منصة / 70% صانع) → تنبيه فوري على البث (OBS / TikTok LIVE Studio) بالاسم والمبلغ والرسالة والصوت.

> **حالة الكود:** كُتب بالكامل، وفُحصت صياغة كل ملفاته، واختُبر منطق العمولة والتحقق من المدخلات ومحوّل FIB بمحاكاة طلبات الشبكة. **لم يُشغَّل مع قاعدة بيانات حقيقية ولا بوابة دفع حقيقية** (بيئة الكتابة بلا إنترنت). شغّله محلياً بالبوابة التجريبية أولاً (الخطوات أدناه) قبل أي نشر.

---

## 1) المعمارية

```
المتبرع ──► /donate/[username] ──► POST /api/donations ──► بوابة الدفع (FIB / ZainCash / تجريبية)
                                        │ يحسب العمولة ويحفظ التبرع PENDING
                                        ▼
بوابة الدفع ──► Webhook (/api/webhooks/fib | /zaincash)
                │ لا يُصدَّق الطلب وحده: نستعلم من البوابة عن الحالة الفعلية
                ▼
        markDonationPaid()  (معاملة ذرية، مرة واحدة فقط)
          ├─ status = PAID
          ├─ رصيد الصانع += 70%
          └─ Socket.io ──► /overlay/[token] (OBS)   +   polling احتياطي كل 2.5 ثانية
```

| الطبقة | التقنية |
|---|---|
| الواجهة + الـ API | Next.js 14 (App Router) + TailwindCSS (عربي RTL) |
| الوقت الحقيقي | Socket.io على نفس الخادم (`server.js`) + polling احتياطي |
| قاعدة البيانات | PostgreSQL على Supabase عبر Prisma |
| الجلسات | JWT (jose) في كوكي httpOnly + bcrypt |
| الاستضافة | Render (الأفضل: يدعم WebSocket) أو Vercel (بدون WebSocket، يعمل بالـ polling) |

### بنية الملفات

```
server.js                 خادم Next + Socket.io
prisma/schema.prisma      الجداول: User, Creator, Donation, Payout, AlertSettings
prisma/seed.js            ينشئ أدمن + صانع تجريبي demo
supabase/schema.sql       نفس المخطط بـ SQL خام (بديل Prisma) + RLS
src/lib/money.js          حساب العمولة
src/lib/donations.js      markDonationPaid + reconcileDonation (قلب النظام المالي)
src/lib/gateways/         fib.js, zaincash.js, mock.js, index.js
src/app/donate/[username] صفحة التبرع العامة
src/app/dashboard         لوحة الصانع (رصيد، تبرعات، سحب، إعدادات التنبيه)
src/app/overlay/[token]   صفحة التنبيه الشفافة لـ OBS
src/app/admin             لوحة الأدمن (طلبات السحب + إحصاءات المنصة)
src/app/api/...           كل مسارات الـ API
```

---

## 2) التشغيل محلياً (بالبوابة التجريبية)

```bash
npm install
cp .env.example .env        # ثم املأ DATABASE_URL و DIRECT_URL و JWT_SECRET و WEBHOOK_SECRET
npx prisma db push          # ينشئ الجداول
psql "$DIRECT_URL" -f supabase/rls.sql   # أو الصق rls.sql في Supabase SQL Editor
npm run db:seed             # أدمن + حساب demo
npm run dev                 # http://localhost:3000
```

جرّب الدورة كاملة (مع `ALLOW_MOCK_PAYMENTS=true`):
1. افتح `http://localhost:3000/login` ← `demo@example.com` / `DemoPass12345`.
2. من "نظرة عامة" افتح **معاينة التنبيه** (`?demo=1`) في تبويب آخر.
3. افتح `/donate/demo` ← تبرّع ← "دفع تجريبي" ← "تأكيد الدفع".
4. افتح رابط التنبيه الحقيقي (بدون `?demo=1`) في تبويب: سيظهر التنبيه فور التأكيد، وسيزيد رصيد الصانع بـ 70% من المبلغ.

---

## 3) بوابات الدفع في العراق — ما هو مدعوم وما هو غير مدعوم

**مهم:** لا FIB ولا ZainCash هما "ماستركارد" بحد ذاتهما.

| البوابة | كيف يدفع المتبرع | الحالة في الكود |
|---|---|---|
| **FIB** | مسح QR أو كود من تطبيق FIB (حساب مصرفي) | مكتوبة بالكامل وفق التوثيق العام + مُختبرة بمحاكاة الشبكة |
| **ZainCash v2** | تحويل لصفحة ZainCash (محفظة + OTP) | مكتوبة وفق التوثيق العام، **وتحتاج اختباراً في UAT** (انظر أدناه) |
| **ماستركارد / فيزا** | بطاقة | **غير مضمّنة.** تحتاج بوابة تقبل البطاقات (مثل Qi Card أو شركة دفع عالمية). لم أجد توثيق API عاماً لـ Qi؛ يُعطى للتاجر بعد التسجيل. |

### FIB
1. سجّل في بيئة الاختبار واحصل على `client_id` و`client_secret` ([توثيق FIB](https://fib.iq/developers/web-payment)).
2. ضعهما في `FIB_CLIENT_ID` / `FIB_CLIENT_SECRET`. القيمة الافتراضية `FIB_BASE_URL` هي بيئة الاختبار.
3. للإنتاج: أرسل نموذج الربط لفريق FIB (integration@fib.iq) واحصل على مفاتيح ورابط الإنتاج، وحدّث `FIB_BASE_URL` (وغيّر `FIB_AUTH_PATH` إن اختلف).
4. الحد الأدنى للدفع عند FIB أكبر من 250 د.ع. الـ callback عندهم **غير موقّع**، لذلك الكود يضيف `?secret=` للرابط ويتحقق من الحالة من الخادم قبل أي إضافة للرصيد.

### ZainCash
1. احصل على `client_id`, `client_secret`, `api key`, و`serviceType` من ZainCash ([التوثيق](https://docs.zaincash.iq/)).
2. ضعها في `ZAINCASH_*`. بيئة الاختبار: `https://pg-api-uat.zaincash.iq`.
3. الـ Webhook يعمل في الإنتاج فقط، وتطلب من ZainCash تسجيل الرابط: `https://دومينك/api/webhooks/zaincash`.
4. **ما لم يوضّحه توثيقهم العام وعليك التحقق منه في UAT** (التعديل في `src/lib/gateways/zaincash.js`):
   - اسم حقل `transactionId` في استجابة `init`.
   - هل `amount.value` بالدينار الكامل (الكود يرسله كذلك).
   - حقول JWT في الـ webhook (الكود يجرّب عدة أسماء ثم يؤكد بالاستعلام).
   - صفحة `/pay/return/[id]` تستعلم من الخادم، فيعمل الربط حتى قبل تفعيل الـ webhook.

### إضافة بوابة بطاقات (Qi Card أو غيرها)
أنشئ ملفاً في `src/lib/gateways/` يصدّر:
```js
export const myGateway = {
  name: 'QICARD', label: 'بطاقة ماستركارد/فيزا',
  isConfigured() { return Boolean(process.env.QI_KEY); },
  async createPayment({ donation, creator }) { /* ... */ return { paymentId, ref, expiresAt, action: { type: 'redirect', url } }; },
  async checkStatus(donation) { /* ... */ return { status: 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED', amount }; },
};
```
ثم أضفه في `gateways/index.js`، وأضف اسمه إلى `enum Gateway` (في `schema.prisma` و`schema.sql`)، وأنشئ مسار webhook شبيهاً بمسار FIB يستدعي `reconcileDonation`.

---

## 4) النشر المجاني

### أ) Supabase (قاعدة البيانات)
1. أنشئ مشروعاً على supabase.com.
2. **Project Settings → Database → Connection string**:
   - `DATABASE_URL` = **Transaction pooler** (المنفذ 6543) + أضف `?pgbouncer=true&connection_limit=5`.
   - `DIRECT_URL` = **Session pooler** (المنفذ 5432 على نفس مضيف الـ pooler). استخدم هذا وليس "Direct connection" لأن الأخير يعمل بـ IPv6 فقط في الخطة المجانية وقد يفشل من Render.
3. أنشئ الجداول بإحدى طريقتين (لا تجمعهما):
   - الصق `supabase/schema.sql` في **SQL Editor** وشغّله. **أو**
   - من جهازك: `npx prisma db push` ثم شغّل `supabase/rls.sql`.
4. RLS مهم: بدونه يمكن لأي شخص يملك مفتاح `anon` العام قراءة جداولك عبر Supabase API.
5. أنشئ الأدمن: من جهازك بعد ضبط `.env`: `npm run db:seed` (غيّر `ADMIN_EMAIL`/`ADMIN_PASSWORD` أولاً).

### ب) Render (موصى به — يدعم Socket.io)
1. ارفع المشروع إلى GitHub.
2. Render → **New → Blueprint** واختر المستودع (يقرأ `render.yaml`)، أو **New Web Service** يدوياً:
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Health check: `/api/health`
3. أضف المتغيرات: `DATABASE_URL`, `DIRECT_URL`, `APP_URL` (= `https://اسم-خدمتك.onrender.com`), `JWT_SECRET`, `WEBHOOK_SECRET`, ومفاتيح البوابات.
4. اضبط `ALLOW_MOCK_PAYMENTS=false` عند الانتقال للدفع الحقيقي.
5. **تنبيه الخطة المجانية:** الخدمة تنام بعد نحو 15 دقيقة بلا زيارات، والاستيقاظ يستغرق ثوانٍ وقد تتأخر الـ webhooks. الحل: أنشئ مراقباً مجانياً (مثل UptimeRobot) يطلب `https://دومينك/api/health` كل 5 دقائق، أو انتقل لخطة مدفوعة قبل الإطلاق الحقيقي.

### ج) Vercel (بديل، بدون WebSocket)
- ارفع المشروع، وأضف نفس المتغيرات. Build command الافتراضي يكفي (`npm run build`).
- Vercel لا يشغّل `server.js` ولا Socket.io، فتعتمد صفحة التنبيه على الـ polling (تأخير 2.5 ثانية تقريباً). زر "إرسال تنبيه تجريبي" لن يعمل، استخدم `?demo=1`.
- أفضل خيار عملي: Render للتطبيق كاملاً.

### د) ربط الـ Webhooks
- FIB: الرابط يُرسل تلقائياً مع كل عملية (`statusCallbackUrl`)، لا تحتاج إعداداً.
- ZainCash: سجّل `https://دومينك/api/webhooks/zaincash` لدى فريقهم.

---

## 5) إضافة التنبيه إلى البث

1. من لوحة التحكم انسخ **رابط التنبيه** (سري).
2. **OBS:** Sources → **+** → **Browser** → الصق الرابط، العرض `1920` والارتفاع `1080`، وأوقف خيار "Shutdown source when not visible".
3. **TikTok LIVE Studio:** أضف مصدراً من نوع **Link/Web page** والصق الرابط (تأكد من اسم الخيار في إصدارك).
4. اختبر بـ `?demo=1` أولاً. إن لم يُسمع الصوت في متصفح عادي اضغط على الصفحة مرة (قيد المتصفح، لا يظهر في OBS).
5. إن تسرّب الرابط اضغط **تغيير رابط التنبيه** في اللوحة.

---

## 6) الأمان — ما هو مطبّق

- التحقق من كل مدخل على الخادم، وتنظيف الأسماء والرسائل (محارف التحكم واتجاه النص)، والعرض بـ React بلا `innerHTML`.
- الكوكي httpOnly + sameSite=lax، وكل طلبات التعديل تشترط `Content-Type: application/json` (حماية CSRF).
- تحديد معدل الطلبات (تسجيل، دخول، تبرع، التنبيه) — **بالذاكرة لكل نسخة تشغيل**.
- المبالغ: لا يُضاف رصيد إلا بعد تأكيد من البوابة نفسها، مع مقارنة المبلغ (FIB)، ومعاملة ذرية تمنع التكرار، وطلب السحب يخصم الرصيد ذرياً.
- كلمات ممنوعة قابلة للضبط في الاسم والرسالة.

## 7) قبل الإطلاق التجاري (ليست كوداً)

- **الجانب القانوني/المالي:** المنصة تستلم أموال الغير وتوزعها، وهذا قد يتطلب ترخيصاً أو ترتيباً خاصاً مع البنك/البوابة. اسأل FIB/ZainCash صراحة عن السماح بهذا النموذج، وعن رسومهم (تُخصم من حصة المنصة في تصميم الكود الحالي).
- **سياسات TikTok:** راجع سياسات TikTok LIVE حول روابط التبرع الخارجية قبل نشرها في البث أو البايو.
- **السحب يدوي:** لوحة الأدمن تتيح الموافقة/الرفض/"تم التحويل"، لكن التحويل الفعلي للصانع تفعله أنت خارج النظام.
- **غير مبني:** استرجاع الأموال، تقارير ضريبية، إشعارات بريدية، استعادة كلمة المرور، 2FA.
