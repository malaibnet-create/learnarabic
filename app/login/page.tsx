'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('');
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMessage('البريد أو كلمة المرور غير صحيحة.');
    router.push('/dashboard');
  }

  return <main className="shell"><section className="auth-page"><a className="brand brand-centered" href="/"><span className="brand-mark">ع</span><span>Dar<span>Lugha</span></span></a><div className="eyebrow">مرحبًا بعودتك</div><h1>سجّل دخولك وتابع رحلتك.</h1><p>كل درس يقربك خطوة من العربية التي تريدها.</p><form onSubmit={submit}><input type="email" aria-label="البريد الإلكتروني" placeholder="البريد الإلكتروني" value={email} onChange={(event) => setEmail(event.target.value)} required /><input type="password" aria-label="كلمة المرور" placeholder="كلمة المرور" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="button" disabled={loading}>{loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</button>{message && <p role="alert">{message}</p>}</form><p className="switch-text">ليس لديك حساب؟ <a className="link" href="/signup">أنشئ حسابًا جديدًا</a></p><a className="link back-link" href="/">العودة إلى الصفحة الرئيسية</a></section></main>;
}
