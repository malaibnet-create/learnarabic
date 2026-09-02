import { levelTwoLessonOneReadingPrivate } from '../../../data/level2/reading-private';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PrivateItem = Record<string, any> & {
  id: string;
  type: string;
  promptAr: string;
  promptEn: string;
};

function seededNumber(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], seed: string) {
  const result = [...values];
  const random = seededNumber(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function normalizeArabic(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, '')
    .replace(/[إأآٱ]/gu, 'ا')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ|ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[«»"'،؛؟!?.,:()\[\]{}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function compact(value: unknown) {
  return normalizeArabic(value).replace(/\s+/gu, '');
}

function wordCount(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text.split(/\s+/u).length : 0;
}

function equalValue(left: unknown, right: unknown) {
  return normalizeArabic(left) === normalizeArabic(right);
}

function detectTargetVocabulary(value: unknown) {
  const text = compact(value);
  return levelTwoLessonOneReadingPrivate.vocabulary
    .filter((family) => {
      const aliases = [family.headwordAr, family.past, family.present, family.masdar, family.activeParticiple, family.passiveParticiple]
        .filter(Boolean)
        .map((entry) => compact(entry))
        .filter((entry) => entry.length >= 3);
      return aliases.some((alias) => text.includes(alias));
    })
    .map((family) => family.headwordAr);
}

function publicImage(path: string) {
  return `/images/level-02/lesson-01/reading/${path.split('/').pop()}`;
}

function publicItem(item: PrivateItem, attemptId: string) {
  const {
    answer: _answer,
    answers: _answers,
    feedbackAr: _feedbackAr,
    feedbackEn: _feedbackEn,
    correctionAr: _correctionAr,
    modelAnswerAr: _modelAnswerAr,
    requiredAny: _requiredAny,
    ...safe
  } = item;
  if (Array.isArray(item.choices)) safe.choices = shuffle(item.choices, `${attemptId}-${item.id}-choices`);
  if (item.type === 'trueFalse') safe.choices = ['صحيح', 'خطأ'];
  if (Array.isArray(item.events)) safe.events = shuffle(item.events, `${attemptId}-${item.id}-events`);
  if (typeof item.image === 'string') safe.image = publicImage(item.image);
  if (item.type === 'vocabularyActivation') safe.targetVocabulary = levelTwoLessonOneReadingPrivate.reading.targetVocabulary;
  return safe;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function gradeItem(item: PrivateItem, response: unknown) {
  let correct = false;
  let detectedTerms: string[] = [];
  let missingRequirements: string[] = [];
  let rubricScore: Record<string, number> | undefined;

  if (item.type === 'imageObservation') {
    correct = wordCount(response) >= 3;
    if (!correct) missingRequirements = ['اكتب ثلاثة أفعال محتملة على الأقل.'];
  } else if (item.type === 'predictionChoice') {
    correct = Boolean(String(response ?? '').trim());
  } else if (item.type === 'predictionOpen') {
    correct = Boolean(String(response ?? '').trim());
  } else if (item.type === 'vocabularyActivation') {
    const data = response && typeof response === 'object' ? response as Record<string, unknown> : {};
    const selections = stringArray(data.selections);
    correct = selections.length >= Number(item.minimumSelections || 4) && Boolean(String(data.explanation ?? '').trim());
    if (selections.length < Number(item.minimumSelections || 4)) missingRequirements.push('اختر أربع كلمات على الأقل.');
    if (!String(data.explanation ?? '').trim()) missingRequirements.push('اكتب جملة تفسّر اختيارك.');
  } else if (item.type === 'trueFalse') {
    const value = typeof response === 'boolean' ? response : equalValue(response, 'صحيح');
    correct = value === Boolean(item.answer);
  } else if (item.type === 'multiSelect') {
    const actual = stringArray(response).map(normalizeArabic).sort();
    const expected = stringArray(item.answers).map(normalizeArabic).sort();
    correct = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  } else if (item.type === 'sequence') {
    const actual = stringArray(response);
    const expected = stringArray(item.answer);
    correct = actual.length === expected.length && actual.every((value, index) => equalValue(value, expected[index]));
  } else if (item.type === 'shortEvidence') {
    const normalized = normalizeArabic(response);
    const evidence = stringArray(item.requiredAny);
    correct = evidence.some((entry) => normalized.includes(normalizeArabic(entry)));
    if (!correct) missingRequirements = ['أضف دليلًا محددًا من النص.'];
  } else if (item.type === 'summaryBuilder') {
    const data = response && typeof response === 'object' ? response as Record<string, unknown> : {};
    const parts = ['beginning', 'planning', 'problem', 'result'];
    const combined = parts.map((part) => String(data[part] ?? '')).join(' ');
    const completedParts = parts.filter((part) => String(data[part] ?? '').trim()).length;
    detectedTerms = detectTargetVocabulary(combined);
    if (completedParts < 4) missingRequirements.push('أكمل أجزاء الملخص الأربعة.');
    if (detectedTerms.length < Number(item.minimumTargetVocabulary || 4)) missingRequirements.push(`استعمل ${item.minimumTargetVocabulary || 4} كلمات من مفردات الدرس.`);
    correct = missingRequirements.length === 0;
  } else if (item.type === 'transferTask') {
    const text = String(response ?? '');
    const words = wordCount(text);
    detectedTerms = detectTargetVocabulary(text);
    const normalized = normalizeArabic(text);
    const taskSignals = [
      /مشروع|موضوع/u.test(normalized),
      /مهم|دور|فريق|مسوول/u.test(normalized),
      /اداه|تطبيق|صور|حاسوب|هاتف|كتاب/u.test(normalized),
      /مشكل|لكن|صعوب|مطر|تغير/u.test(normalized),
    ].filter(Boolean).length;
    const connector = /ثم|لذلك|لكن|بعد|قبل/u.test(normalized);
    const sentenceCount = text.split(/[.!؟\n]+/u).filter((entry) => entry.trim()).length;
    rubricScore = {
      task: Math.min(3, Math.ceil(taskSignals * 0.75)),
      organization: Number(words >= Number(item.minimumWords || 70) && words <= Number(item.maximumWords || 90)) + Number(connector),
      vocabulary: Math.min(3, Math.round((detectedTerms.length / Number(item.minimumTargetVocabulary || 6)) * 3)),
      accuracy: Number(words >= 45) + Number(sentenceCount >= 3),
    };
    if (words < Number(item.minimumWords || 70) || words > Number(item.maximumWords || 90)) missingRequirements.push(`اكتب بين ${item.minimumWords} و${item.maximumWords} كلمة.`);
    if (detectedTerms.length < Number(item.minimumTargetVocabulary || 6)) missingRequirements.push(`استعمل ${item.minimumTargetVocabulary} كلمات مستهدفة على الأقل.`);
    if (taskSignals < 3) missingRequirements.push('اذكر الموضوع والمهام والأدوات والمشكلة المحتملة.');
    correct = missingRequirements.length === 0 && Object.values(rubricScore).reduce((sum, score) => sum + score, 0) >= 7;
  } else if (item.type === 'discussion') {
    const normalized = normalizeArabic(response);
    const hasBecause = normalized.includes('لان');
    const hasTherefore = normalized.includes('لذلك');
    if (!hasBecause) missingRequirements.push('استعمل «لأنّ».');
    if (!hasTherefore) missingRequirements.push('استعمل «لذلك».');
    if (wordCount(response) < 20) missingRequirements.push('قدّم سببين واضحين على الأقل.');
    correct = missingRequirements.length === 0;
  } else if ('answer' in item) {
    correct = equalValue(response, item.answer);
  }

  return { correct, detectedTerms, missingRequirements, rubricScore };
}

function modelAnswer(item: PrivateItem) {
  if (item.type === 'imageObservation') return item.suggestedTerms;
  if (item.type === 'predictionOpen') return 'التخطيط، تقسيم المهام، جمع المعلومات، إعداد العرض، ثم المراجعة.';
  if (item.type === 'vocabularyActivation') return 'مثال: أتوقع كلمات خَطَّطَ، شَارَكَ، تَوَاصَلَ، ونَجَحَ لأن النص يتحدث عن مشروع جماعي.';
  if (item.modelAnswerAr) return item.modelAnswerAr;
  if (item.correctionAr && item.answer === false) return item.correctionAr;
  if (item.answers) return item.answers;
  if (item.answer !== undefined) return item.answer;
  if (item.type === 'summaryBuilder') return 'اكتب جملة مستقلة لكل جزء: البداية، والتخطيط، والمشكلة، والنتيجة.';
  return undefined;
}

export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get('attempt') || 'default-attempt';
  const privateStages = levelTwoLessonOneReadingPrivate.exercises.stages as unknown as Array<{ id: string; titleAr: string; titleEn: string; items: PrivateItem[] }>;
  const stages = privateStages.map((stage) => ({
    id: stage.id,
    titleAr: stage.titleAr,
    titleEn: stage.titleEn,
    items: stage.items.map((item) => publicItem(item, attemptId)),
  }));
  return Response.json({ stages, feedbackPolicy: levelTwoLessonOneReadingPrivate.exercises.feedbackPolicy }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const privateStages = levelTwoLessonOneReadingPrivate.exercises.stages as unknown as Array<{ items: PrivateItem[] }>;
  const item = privateStages.flatMap((stage) => stage.items).find((entry) => entry.id === id);
  if (!item) return Response.json({ error: 'ITEM_NOT_FOUND' }, { status: 404 });

  const attemptNumber = Math.max(1, Math.min(2, Number(body.attemptNumber) || 1));
  const result = gradeItem(item, body.response);
  const isOpenPrediction = item.type === 'predictionChoice' || item.type === 'predictionOpen';
  const reveal = !result.correct && !isOpenPrediction && attemptNumber >= 2;
  const feedbackAr = isOpenPrediction
    ? 'حُفِظ توقّعك. ستقارنه بالنص بعد القراءة.'
    : item.feedbackAr || (result.correct ? 'إجابة صحيحة. أحسنت الاستدلال من النص.' : reveal ? 'راجع الدليل أو النموذج، ثم أضف هذا النشاط إلى المراجعة.' : 'ليست الإجابة دقيقة بعد. ارجع إلى النص وحاول مرة أخرى.');
  const feedbackEn = isOpenPrediction
    ? 'Your prediction is saved. You will compare it with the text after reading.'
    : item.feedbackEn || (result.correct ? 'Correct. Your answer is supported by the text.' : reveal ? 'Review the evidence or model, then add this activity to review.' : 'Not quite. Return to the text and try once more.');

  return Response.json({
    correct: result.correct || isOpenPrediction,
    feedbackAr,
    feedbackEn,
    reveal,
    modelAnswer: reveal ? modelAnswer(item) : undefined,
    detectedTerms: result.detectedTerms,
    missingRequirements: result.missingRequirements,
    rubricScore: result.rubricScore,
  });
}
