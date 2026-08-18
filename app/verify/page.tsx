'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function VerifyPage() { const router = useRouter(); const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [token, setToken] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => { const params = new URLSearchParams(window.location.search); setEmail(params.get('email') ?? ''); setName(params.get('name') ?? ''); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); const supabase = createClient(); const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' }); if (error) { setLoading(false); setMessage('الرمز غير صحيح أو انتهت صلاحيته.'); return; } const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('profiles').upsert({ id: user.id, full_name: name || user.user_metadata.full_name, age: user.user_metadata.age, started_learning: user.user_metadata.started_learning, learning_goal: user.user_metadata.learning_goal, interests: user.user_metadata.interests ? [user.user_metadata.interests] : [] }); setLoading(false); router.push('/welcome'); }
  return <main className="shell"><section className="auth-page"><div className="eyebrow">تحقق آمن</div><h1>تحقق من بريدك.</h1><p>أدخل رمز OTP الذي أرسلناه إلى:</p><strong>{email}</strong><form onSubmit={submit}><input aria-label="رمز التحقق" inputMode="numeric" placeholder="رمز التحقق" value={token} onChange={(event) => setToken(event.target.value)} required /><button className="button" disabled={loading}>{loading ? 'جارٍ التحقق...' : 'تأكيد البريد الإلكتروني'}</button>{message && <p role="alert">{message}</p>}</form></section></main>;
}
