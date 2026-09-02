'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSectionStates, hydrateLearningDataFromCloud, requiredSections, type LearningSection } from '../../../lib/learning-progress';

const sections = [
  ['🧠', 'المفردات', 'Vocabulary', 'تعلّم الكلمات الجديدة وتدرّب عليها', 'vocabulary'],
  ['📖', 'القراءة', 'Reading', 'اقرأ نصًا مناسبًا لمستواك', 'reading'],
  ['🎧', 'الاستماع', 'Listening', 'افهم العربية كما تُنطق', 'listening'],
  ['◈', 'القواعد', 'Grammar', 'ابنِ جملًا صحيحة وواضحة', 'grammar'],
  ['💬', 'المحادثة', 'Speaking', 'تدرّب على مواقف الحياة اليومية', 'conversation'],
  ['✍️', 'الكتابة', 'Writing', 'عبّر عن أفكارك بثقة', 'writing'],
  ['🧩', 'العبارات والتراكيب', 'Phrases & Structures', 'افهم العبارات الوظيفية واستعملها بدقة', 'phrases'],
] as const;

type SectionKey = typeof sections[number][4];
type LevelCode = 'A1' | 'A2' | 'B1';

const levelConfig: Record<LevelCode, {
  nameAr: string;
  nameEn: string;
  lessonCount: number;
  lessonTitles: string[];
  description: string;
}> = {
  A1: {
    nameAr: 'المستوى المبتدئ',
    nameEn: 'Beginner',
    lessonCount: 2,
    lessonTitles: ['الدراسة والهوية', 'الأسرة والعمل'],
    description: 'درسان متكاملان لبناء أساسك في العربية خطوة بخطوة.',
  },
  A2: {
    nameAr: 'المستوى المتوسط',
    nameEn: 'Intermediate',
    lessonCount: 10,
    lessonTitles: [
      'الدراسة والعمل والتطور الشخصي',
      'الدرس الثاني · قريبًا',
      'الدرس الثالث · قريبًا',
      'الدرس الرابع · قريبًا',
      'الدرس الخامس · قريبًا',
      'الدرس السادس · قريبًا',
      'الدرس السابع · قريبًا',
      'الدرس الثامن · قريبًا',
      'الدرس التاسع · قريبًا',
      'الدرس العاشر · قريبًا',
    ],
    description: 'عشرة دروس متدرجة لتوسيع المفردات وتطوير الفهم والتعبير باللغة العربية.',
  },
  B1: {
    nameAr: 'المستوى المتقدم',
    nameEn: 'Advanced',
    lessonCount: 1,
    lessonTitles: ['الِاعْتِرَافُ بِالْخَطَإِ فَضِيلَةٌ'],
    description: 'لغة متقدمة للتفكير والنقاش واتخاذ القرار.',
  },
};

function safeCode(value: string): LevelCode {
  const upper = value.toUpperCase();
  return upper === 'A2' || upper === 'B1' ? upper : 'A1';
}

function readProgress(code: LevelCode, lesson: number): boolean[] {
  if (typeof window === 'undefined') return sections.map(() => false);
  const states = getSectionStates(code, lesson);
  return sections.map((section) => section[4] === 'writing' ? false : states[section[4] as LearningSection] === 'completed');
}

function isSectionAvailable(code: LevelCode, lesson: number, key: SectionKey) {
  if (code === 'A1') return (lesson === 1 || lesson === 2) && (key === 'vocabulary' || key === 'reading' || key === 'listening' || key === 'grammar' || key === 'conversation');
  if (code === 'A2') return lesson === 1 && (key === 'vocabulary' || key === 'reading' || key === 'listening' || key === 'grammar' || key === 'conversation');
  if (code === 'B1') return lesson === 1 && (key === 'vocabulary' || key === 'reading' || key === 'listening' || key === 'grammar' || key === 'conversation' || key === 'phrases');
  return false;
}

export default function LevelPage({ params }: { params: Promise<{ levelCode: string }> }) {
  const [code, setCode] = useState<LevelCode>('A1');
  const [selectedLesson, setSelectedLesson] = useState(1);
  const [, refresh] = useState(0);

  useEffect(() => {
    params.then(({ levelCode }) => {
      setCode(safeCode(levelCode));
      const requested = Number(new URLSearchParams(window.location.search).get('lesson') || '1');
      setSelectedLesson(Number.isInteger(requested) && requested > 0 ? requested : 1);
    });
  }, [params]);

  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    void hydrateLearningDataFromCloud().then(() => update());
    window.addEventListener('storage', update);
    window.addEventListener('darlugha-progress-changed', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('darlugha-progress-changed', update);
      window.removeEventListener('focus', update);
    };
  }, []);

  const config = levelConfig[code];
  const lessons = useMemo(
    () => Array.from({ length: config.lessonCount }, (_, index) => index + 1),
    [config.lessonCount],
  );
  const progress = readProgress(code, selectedLesson);
  const availableSections = sections.map((section) => isSectionAvailable(code, selectedLesson, section[4]));
  const availableCount = availableSections.filter(Boolean).length;
  const completedCount = progress.filter((done, index) => done && availableSections[index]).length;
  const allDone = availableCount > 0 && completedCount === availableCount;
  const visibleSections = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => isSectionAvailable(code, selectedLesson, section[4]));

  function isUnlocked(lesson: number) {
    if (lesson === 1) return true;
    if (code === 'B1') return true;
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`darlugha-${code.toLowerCase()}-lesson-${lesson - 1}-exam`) === 'passed';
  }

  function openSection(index: number, key: SectionKey) {
    if (!isUnlocked(selectedLesson) || !isSectionAvailable(code, selectedLesson, key)) return;
    if (code === 'A2' && selectedLesson === 1 && key === 'vocabulary') {
      window.location.href = '/levels/A2/lessons/1/vocabulary';
      return;
    }
    if (code === 'A2' && selectedLesson === 1 && key === 'reading') {
      window.location.href = '/levels/A2/lessons/1/reading';
      return;
    }
    if (code === 'A2' && selectedLesson === 1 && key === 'listening') {
      window.location.href = '/levels/A2/lessons/1/listening';
      return;
    }
    if (code === 'A2' && selectedLesson === 1 && key === 'grammar') {
      window.location.href = '/levels/A2/lessons/1/grammar';
      return;
    }
    if (code === 'A2' && selectedLesson === 1 && key === 'conversation') {
      window.location.href = '/levels/A2/lessons/1/conversation';
      return;
    }
    if (code === 'B1' && key === 'vocabulary') {
      window.location.href = '/levels/B1/lessons/1/vocabulary';
      return;
    }
    if (code === 'B1' && key === 'phrases') {
      window.location.href = '/levels/B1/lessons/1/phrases';
      return;
    }
    if (code === 'B1' && key === 'reading') {
      window.location.href = '/levels/B1/lessons/1/reading';
      return;
    }
    if (code === 'B1' && key === 'listening') {
      window.location.href = '/levels/B1/lessons/1/listening';
      return;
    }
    if (code === 'B1' && key === 'grammar') {
      window.location.href = '/levels/B1/lessons/1/grammar';
      return;
    }
    if (code === 'B1' && key === 'conversation') {
      window.location.href = '/levels/B1/lessons/1/conversation';
      return;
    }
    const target = key === 'conversation' ? 'speaking' : key;
    window.location.href = `/lessons/${selectedLesson}/${target}?level=${code}`;
    refresh((value) => value + index + 1);
  }

  function openExam() {
    if (!allDone) return;
    if (code === 'A2' && selectedLesson === 1) {
      window.location.href = '/levels/A2/lessons/1/exam';
      return;
    }
    if (code === 'B1' && selectedLesson === 1) {
      window.location.href = '/levels/B1/lessons/1/exam';
      return;
    }
    window.location.href = `/levels/${code}/exam?lesson=${selectedLesson}`;
  }

  return <main className="shell">
    <section className="level-page">
      <div className="level-head">
        <div>
          <a className="back-link" href="/lessons">← {code === 'A1' ? 'All levels' : 'كل المستويات · All levels'}</a>
          <div className="eyebrow">{config.nameAr} · <span dir="ltr">{config.nameEn}</span> · {code}</div>
          <h1>{config.nameAr}</h1>
          <p>{config.description}</p>
        </div>
        {config.lessonCount > 0 && <div className="test-reminder">
          <strong>{completedCount} / {availableCount}</strong><br />
          <small>{code === 'A1' ? 'completed sections' : 'أقسام مكتملة · completed sections'}</small>
        </div>}
      </div>

      {config.lessonCount === 0 ? <div className="lesson-message">
        <strong>المستوى المتوسط قيد الإعداد · Intermediate is coming soon</strong>
        <p>لن يفتح هذا المستوى دروس المبتدئ. ستظهر دروسه هنا عند إضافتها.</p>
        <a className="button" href="/lessons">العودة إلى المستويات</a>
      </div> : <>
        <div className="lesson-picker" aria-label={`دروس ${config.nameAr}`}>
          {lessons.map((lesson) => <button
            key={lesson}
            type="button"
            className={`lesson-chip ${selectedLesson === lesson ? 'active' : ''} ${isUnlocked(lesson) ? '' : 'locked'}`}
            onClick={() => isUnlocked(lesson) && setSelectedLesson(lesson)}
            disabled={!isUnlocked(lesson)}
          >
            <span>{isUnlocked(lesson) ? lesson : '🔒'}</span><small>{code === 'A1' ? 'Lesson' : 'الدرس · Lesson'}</small>
          </button>)}
        </div>

        <div className="lesson-title-row">
          <div>
            <div className="eyebrow">{code === 'A1' ? `Lesson ${selectedLesson} of ${config.lessonCount}` : `الدرس ${selectedLesson} من ${config.lessonCount} · Lesson ${selectedLesson}`}</div>
            <h2>{config.lessonTitles[selectedLesson - 1]}</h2>
          </div>
          <span className="lesson-status">
            {code === 'B1'
              ? allDone ? 'جاهز للامتحان النهائي ✓ · Final exam ready' : 'المفردات والقراءة والاستماع والقواعد والمحادثة والعبارات متاحة الآن · Six advanced sections available'
              : code === 'A2'
                ? allDone ? 'أكملت المفردات والقراءة والاستماع والقواعد والمحادثة ✓ · Five sections complete' : 'المفردات والقراءة والاستماع والقواعد والمحادثة متاحة الآن · Five sections available'
              : allDone ? 'Lesson exam ready ✓' : 'Five lesson sections available'}
          </span>
        </div>

        <div className="category-grid lesson-sections">
          {visibleSections.map(({ section: [icon, title, titleEn, desc, key], index }) => {
            const available = availableSections[index];
            return <button
              key={key}
              type="button"
              className={`category-card ${progress[index] ? 'done' : ''} ${index === 0 ? 'first-section' : ''} ${available ? '' : 'locked'}`}
              onClick={() => openSection(index, key)}
              disabled={!available}
              aria-disabled={!available}
            >
              <span className="category-icon">{available ? icon : '🔒'}</span>
              <strong>{title}</strong>
              <span dir="ltr">{titleEn}</span>
              <small>{available ? progress[index] ? (code === 'A1' ? 'Completed ✓' : 'مكتمل ✓ · Completed') : index === 0 ? (code === 'A1' ? 'Start here' : 'ابدأ هنا · Start here') : (code === 'A1' ? 'Open section' : 'افتح القسم · Open section') : 'قريبًا · Coming soon'}<br />{code === 'A1' ? titleEn : desc}</small>
            </button>;
          })}
        </div>

        <div className="lesson-message">
          {code === 'B1'
            ? 'ابدأ بالمفردات، ثم اقرأ النص المتقدم، واستمع إلى الحوار، وادرس القواعد، ثم ادخل غرفة المحادثة الصوتية واستعمل العبارات والتراكيب.'
            : code === 'A2'
              ? progress[4]
                ? 'أحسنت! أكملت الأقسام الخمسة. يمكنك الآن بدء الامتحان النهائي للدرس الأول.'
                : progress[3]
                  ? 'أحسنت في القواعد. انتقل الآن إلى غرفة المحادثة وخطّط لورشة ثقافية مع المحاور الصوتي.'
                : progress[2]
                  ? 'أحسنت في الاستماع. انتقل الآن إلى قواعد «مِنَ الفِعْلِ إِلَى المَصْدَرِ».'
                : progress[1]
                  ? 'أحسنت في القراءة. انتقل الآن إلى استماع «خُطَّةٌ لِوَرْشَةِ السَّبْتِ».'
                : progress[0]
                  ? 'أحسنت في المفردات. انتقل الآن إلى قراءة «مشروع صغير يُعَرِّفُ بمدينة وليلي».'
                  : 'ابدأ بالمفردات، ثم القراءة المتعمقة، ثم الاستماع.'
            : allDone
              ? 'Great work! You completed all lesson sections. The lesson exam is now available.'
              : progress[0]
                ? 'Vocabulary is complete. You may now choose any other lesson section.'
                : 'Start with vocabulary, or choose another lesson section.'}
        </div>

        {(code === 'A1' || code === 'A2' || code === 'B1') && <div className="level-footer">
          <span className="exam-note">{allDone ? code === 'A1' ? 'Lesson exam unlocked.' : (code === 'B1' || code === 'A2' ? 'الامتحان النهائي للدرس الأول متاح الآن.' : 'امتحان الدرس متاح الآن.') : code === 'A1' ? `Complete all ${requiredSections('A1').length} sections to unlock the lesson exam.` : `أكمل الأقسام ${code === 'A2' ? 'الخمسة' : 'الستة'} لفتح امتحان الدرس.`}</span>
          <button className={`exam-button ${allDone ? '' : 'disabled'}`} type="button" onClick={openExam} disabled={!allDone}>{code === 'A1' ? 'Lesson exam' : 'الامتحان النهائي · Final exam'} ←</button>
        </div>}
      </>}
    </section>
  </main>;
}
