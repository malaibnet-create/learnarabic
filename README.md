# ArabicPath — Next.js foundation

هذه هي بداية تحويل الواجهة التجريبية إلى تطبيق حقيقي.

## التشغيل

يتطلب المشروع Node.js 20 أو أحدث. بعد تثبيت Node.js:

```bash
npm install
npm run dev
```

ثم افتح `http://localhost:3000`.

## ما تم تجهيزه

- Next.js مع TypeScript وApp Router.
- واجهة عربية RTL.
- الشعار داخل `public/assets/arabicpath-logo.png`.
- صفحات أولية: الرئيسية، تسجيل الدخول، اختبار تحديد المستوى، لوحة الطالب، وصفحة الدرس.
- مخطط PostgreSQL/Supabase داخل `supabase/schema.sql`.
- تسجيل دخول بالبريد ورمز OTP عبر Supabase.
- تدفق واضح: تسجيل دخول، إنشاء حساب، بيانات شخصية، رابط تفعيل بالبريد، ثم ترحيب واختيار اختبار المستوى.
- لوحة رئيسية بثلاثة مسارات: الدروس، حجز مدرس، والمدرس الآلي.
- هوية بصرية مغربية بنقوش زليج CSS متجاوبة.
- صفحة مستويات A1 وA2 وB1، وخمسة أقسام داخل كل مستوى، مع قفل امتحان المستوى حتى الإكمال.
- اختبار تحديد مستوى من 5 أسئلة وحفظ النتيجة في `placement_attempts`.
- لوحة الطالب تقرأ الدروس المنشورة من جدول `lessons`.

## إعداد Supabase

1. أنشئ مشروعًا من [supabase.com](https://supabase.com/).
2. من إعدادات المشروع انسخ Project URL وPublishable key.
3. انسخ `.env.example` إلى ملف باسم `.env.local`.
4. ضع القيمتين في `.env.local`، ولا ترفع هذا الملف إلى GitHub.
5. من SQL Editor شغّل محتوى `supabase/schema.sql`.
6. في Authentication > URL Configuration أضف `http://localhost:3000` إلى Site URL.

بعد إنشاء الجداول الأساسية، شغّل ملفي `supabase/migrations/002_placement_and_demo_lessons.sql` ثم `supabase/migrations/003_profile_preferences.sql` في SQL Editor. الأول يضيف نتائج اختبار المستوى والدروس التجريبية، والثاني يضيف حقول تخصيص الطالب. لا تعِد تشغيل `schema.sql` كاملًا على مشروع يحتوي الجداول مسبقًا.

للتفعيل بالرابط، استخدم قالب `Confirm signup` الذي يحتوي على `{{ .ConfirmationURL }}`. يجب إضافة `http://localhost:3000/auth/callback` إلى قائمة Redirect URLs في Supabase أثناء التطوير.

يستخدم المشروع `signInWithOtp` لإرسال رمز البريد و`verifyOtp` لتأكيد الدخول. مفاتيح البيئة المحلية لا تُضاف إلى GitHub.

## الخطوة التالية

إنشاء مشروع Supabase، تشغيل مخطط قاعدة البيانات، ثم ربط نموذج تسجيل الدخول بـ OTP.
