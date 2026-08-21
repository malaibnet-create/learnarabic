import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return <main className="shell"><header className="topbar"><div className="brand"><Image src="/assets/arabicpath-logo.png" alt="شعار ArabicPath" width={52} height={43} /><span>Dar<span>Lugha</span></span></div><div className="header-actions"><Link className="link" href="/login">تسجيل الدخول</Link><Link className="button small-button" href="/signup">إنشاء حساب</Link></div></header><section className="hero"><div><div className="eyebrow">رحلتك إلى العربية تبدأ هنا</div><h1>تعلّم العربية<br /><em>بطريقة تلهمك.</em></h1><p>دروس قصيرة، تدريب عملي، ومدرس ذكي يساعدك على التقدم بثقة — خطوة واحدة في كل مرة.</p><div className="actions"><Link className="button" href="/signup">ابدأ رحلتك الآن ←</Link><Link className="link" href="/placement-test">أخذ اختبار تحديد المستوى</Link></div></div><div className="visual"><Image src="/assets/arabicpath-logo.png" alt="DarLugha" width={600} height={500} priority /></div></section></main>;
}
