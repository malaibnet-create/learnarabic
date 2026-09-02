'use client';

import { useRouter } from 'next/navigation';

export default function WelcomePage(){const router=useRouter();return <main className="shell"><section className="auth-page"><div className="success-mark">✓</div><div className="eyebrow">أهلًا بك معنا</div><h1>تم إنشاء حسابك بنجاح! 🎉</h1><p>أصبحت جاهزًا لبدء رحلة مميزة في تعلم العربية.</p><div className="auth-choice"><button className="button" onClick={()=>router.push('/placement-test')}>أخذ اختبار تحديد المستوى الآن</button><button className="button secondary" onClick={()=>router.push('/dashboard')}>سأفعل ذلك لاحقًا</button></div></section></main>}
