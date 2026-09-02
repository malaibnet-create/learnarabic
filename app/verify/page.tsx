'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

const RESEND_SECONDS = 60;

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') ?? '');
    setName(params.get('name') ?? '');
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: token.replace(/\D/g, ''), type: 'signup' });
    if (error) {
      setLoading(false);
      setMessage('الرمز غير صحيح أو انتهت صلاحيته.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: name || user.user_metadata.full_name,
        age: user.user_metadata.age,
        started_learning: user.user_metadata.started_learning,
        arabic_track: user.user_metadata.arabic_track,
        learning_goal: user.user_metadata.learning_goal,
        interests: user.user_metadata.interests ? [user.user_metadata.interests] : [],
      });
    }
    setLoading(false);
    router.push('/welcome');
  }

  async function resend() {
    if (!email || resendIn > 0 || loading) return;
    setLoading(true);
    setMessage('');
    const { error } = await createClient().auth.resend({ type: 'signup', email });
    setLoading(false);
    if (error) {
      setMessage(error.status === 429 ? 'أرسلت طلبات كثيرة. انتظر قليلًا قبل المحاولة مجددًا.' : 'تعذر إرسال رمز جديد.');
      return;
    }
    setResendIn(RESEND_SECONDS);
    setMessage('أرسلنا رمزًا جديدًا إلى بريدك الإلكتروني.');
  }

  return <main className="shell"><section className="auth-page">
    <div className="eyebrow">تحقق آمن</div>
    <h1>تحقق من بريدك.</h1>
    <p>أدخل رمز OTP الرقمي الذي أرسلناه إلى:</p>
    <strong dir="ltr">{email}</strong>
    <form onSubmit={submit}>
      <input aria-label="رمز التحقق" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="رمز التحقق" value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))} required />
      <button className="button" disabled={loading || token.length < 6}>{loading ? 'جارٍ التحقق...' : 'تأكيد البريد الإلكتروني'}</button>
      {message && <p role="status">{message}</p>}
    </form>
    <button className="review-button" type="button" disabled={resendIn > 0 || loading} onClick={resend}>{resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ثانية` : 'إرسال رمز جديد'}</button>
  </section></main>;
}
