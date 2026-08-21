'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage(''); setError('');
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (resetError) return setError('تعذر إرسال الرسالة. تحقق من البريد وإعدادات Supabase.');
    setMessage('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.');
  }

  return <main className="shell"><section className="auth-page">
    <a className="brand brand-centered" href="/"><span className="brand-mark">ع</span><span>Dar<span>Lugha</span></span></a>
    <div className="eyebrow">استعادة الحساب</div><h1>نسيت كلمة المرور؟</h1>
    <p>أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لإنشاء كلمة مرور جديدة.</p>
    <form onSubmit={submit}><input type="email" aria-label="البريد الإلكتروني" placeholder="البريد الإلكتروني" value={email} onChange={event => setEmail(event.target.value)} required />
      <button className="button" disabled={loading}>{loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}</button>
      {message && <p className="success-text" role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    </form><a className="link back-link" href="/login">العودة إلى تسجيل الدخول</a>
  </section></main>;
}
