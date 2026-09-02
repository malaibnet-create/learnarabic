const levels = [
  {
    code: 'A1',
    nameAr: 'المستوى المبتدئ',
    nameEn: 'Beginner',
    desc: 'ابدأ من الأساس وتعلّم مفردات الحياة اليومية وبناء الجملة.',
    className: 'a1',
  },
  {
    code: 'A2',
    nameAr: 'المستوى المتوسط',
    nameEn: 'Intermediate',
    desc: 'وسّع لغتك وافهم نصوصًا ومحادثات أكثر تنوعًا.',
    className: 'a2',
  },
  {
    code: 'B1',
    nameAr: 'المستوى المتقدم',
    nameEn: 'Advanced',
    desc: 'ناقش الأفكار العامة واستعمل لغة دقيقة في مواقف متقدمة.',
    className: 'b1',
  },
];

export default function LessonsPage() {
  return <main className="shell">
    <section className="levels-page">
      <div className="levels-heading">
        <div className="eyebrow">مسارك التعليمي · Your learning path</div>
        <h1>اختر مستواك وابدأ الرحلة</h1>
        <p>ثلاثة مستويات واضحة من الأساس إلى الاستخدام المتقدم للغة العربية.</p>
      </div>
      <div className="levels-grid">
        {levels.map((level) => <a className={`level-card ${level.className}`} href={`/levels/${level.code}`} key={level.code}>
          <h2>{level.code}</h2>
          <strong>{level.nameAr}</strong>
          <span dir="ltr">{level.nameEn}</span>
          <small>{level.desc}</small>
        </a>)}
      </div>
    </section>
  </main>;
}
