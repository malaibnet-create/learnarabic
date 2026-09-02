'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setEmail(new URLSearchParams(window.location.search).get('email') || ''), []);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('');
    const { error } = await createClient().auth.verifyOtp({ email, token: token.replace(/\D/g, ''), type: 'recovery' });
    setLoading(false);
    if (error) return setMessage('الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا وحاول مرة أخرى.');
    setConfirmed(true);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('');
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setMessage('تعذر تغيير كلمة المرور. تأكد من أنها تحتوي على 6 أحرف على الأقل.');
    router.push('/login?password=updated');
  }

  return <main className="shell"><section className="auth-page"><div className="eyebrow">استعادة آمنة</div><h1>{confirmed ? 'اختر كلمة مرور جديدة' : 'أدخل رمز الاستعادة'}</h1>{!confirmed ? <><p>أرسلنا رمزًا رقميًا إلى:</p><strong dir="ltr">{email}</strong><form onSubmit={verify}><input aria-label="رمز الاستعادة" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="رمز الاستعادة" value={token} onChange={event => setToken(event.target.value.replace(/\D/g, ''))} required /><button className="button" disabled={loading || token.length < 6}>{loading ? 'جارٍ التحقق...' : 'تحقق من الرمز'}</button>{message && <p role="alert">{message}</p>}</form><a className="link" href="/forgot-password">طلب رمز جديد</a></> : <form onSubmit={savePassword}><input type="password" minLength={6} autoComplete="new-password" aria-label="كلمة المرور الجديدة" placeholder="كلمة المرور الجديدة" value={password} onChange={event => setPassword(event.target.value)} required /><button className="button" disabled={loading}>{loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}</button>{message && <p role="alert">{message}</p>}</form>}</section></main>;
}
