import { levelTwoLessonOneGrammarPrivate } from '../../../data/level2/grammar-private';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PrivateItem = Record<string, any> & { id: string; type: string; promptAr: string; promptEn: string };

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

// Arabic comparison ignores presentation-only differences so a correctly ordered
// sentence is not rejected merely because the model answer ends with punctuation.
function normalizeArabic(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, '')
    .replace(/[إأآٱ]/gu, 'ا')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ|ى/gu, 'ي')
    .replace(/[«»"'،؛؟!?.,:()\[\]{}]/gu, '')
    .replace(/\s+/gu, '')
    .trim();
}

function equalValue(left: unknown, right: unknown) {
  return normalizeArabic(left) === normalizeArabic(right);
}

function audioPath(path: string) {
  return `/audio/level-02/lesson-01/grammar/${path.split('/').pop()}`;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sameStringSet(actual: unknown, expected: unknown) {
  const left = stringArray(actual).map(normalizeArabic).sort();
  const right = stringArray(expected).map(normalizeArabic).sort();
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function publicItem(item: PrivateItem, attemptId: string) {
  const {
    answer: _answer, modelAnswer: _modelAnswer, modelAnswers: _modelAnswers,
    requiredTerms: _requiredTerms, pairs: _pairs, groups: _groups, blanks: _blanks,
    feedbackAr: _feedbackAr, feedbackEn: _feedbackEn, ...safe
  } = item;
  if (Array.isArray(item.choices)) safe.choices = shuffle(item.choices, `${attemptId}-${item.id}-choices`);
  if (Array.isArray(item.tokens)) safe.tokens = shuffle(item.tokens, `${attemptId}-${item.id}-tokens`);
  if (item.type === 'match') {
    safe.left = item.pairs.map((pair: string[]) => pair[0]);
    safe.right = shuffle(item.pairs.map((pair: string[]) => pair[1]), `${attemptId}-${item.id}-pairs`);
  }
  if (item.type === 'familySort') {
    safe.groupLabels = Object.keys(item.groups);
    safe.values = shuffle(Object.values(item.groups).flat(), `${attemptId}-${item.id}-groups`);
  }
  if (item.type === 'cloze') safe.blankCount = item.blanks.length;
  if (typeof item.audio === 'string') safe.audio = audioPath(item.audio);
  if (typeof item.audioA === 'string') safe.audioA = audioPath(item.audioA);
  if (typeof item.audioB === 'string') safe.audioB = audioPath(item.audioB);
  return safe;
}

function detectPatterns(value: unknown) {
  const text = normalizeArabic(value);
  const detected: string[] = [];
  if (/ان[ابتني][\p{L}]+/u.test(text)) detected.push('أَنْ + مضارع مفرد');
  if (/ان[يتن][\p{L}]+وا/u.test(text) || /ان[ت][\p{L}]+ي/u.test(text)) detected.push('حذف النون');
  if (/(الى|في|على|ب)[\p{L}]+/u.test(text)) detected.push('حرف جر + مصدر');
  if (/قررتان/u.test(text)) detected.push('قَرَّرْتُ أَنْ');
  if (/احتاجالى/u.test(text)) detected.push('أَحْتَاجُ إِلَى');
  if (/اهتمب/u.test(text)) detected.push('أَهْتَمُّ بِـ');
  if (/نجحتفي/u.test(text)) detected.push('نَجَحْتُ فِي');
  return [...new Set(detected)];
}

function modelFor(item: PrivateItem) {
  if (item.modelAnswer) return item.modelAnswer;
  if (item.modelAnswers) return item.modelAnswers;
  if (item.answer !== undefined) return item.answer;
  if (item.type === 'match') return Object.fromEntries(item.pairs);
  if (item.type === 'familySort') return item.groups;
  if (item.type === 'cloze') return item.blanks.map((blank: { answer: string }) => blank.answer);
  if (item.type === 'guidedProduction') return [
    'قَرَّرْتُ أَنْ أُنَفِّذَ مَشْرُوعًا جَدِيدًا.',
    'أَحْتَاجُ إِلَى تَخْطِيطٍ جَيِّدٍ.',
    'أَهْتَمُّ بِتَطْوِيرِ فِكْرَتِي.',
    'نَجَحْتُ فِي تَنْفِيذِ الخُطَّةِ.',
  ];
  if (item.type === 'exitTicket') return {
    singular: 'أُرِيدُ أَنْ أَدْرُسَ العَرَبِيَّةَ.',
    fiveVerb: 'قَرَّرَ الطُّلَّابُ أَنْ يَعْمَلُوا مَعًا.',
    preposition: 'نَجَحْتُ فِي تَنْظِيمِ الوَرْشَةِ.',
  };
  return undefined;
}

function gradeItem(item: PrivateItem, response: unknown) {
  let correct = false;
  let score = 0;
  let maxScore = 1;
  let detectedPatterns: string[] = [];
  const missingRequirements: string[] = [];
  let rubricScore: Record<string, number> | undefined;

  if (item.type === 'match') {
    const data = recordValue(response);
    correct = item.pairs.every((pair: string[]) => equalValue(data[pair[0]], pair[1]));
  } else if (item.type === 'familySort') {
    const data = recordValue(response);
    correct = Object.entries(item.groups).every(([label, values]) => sameStringSet(data[label], values));
  } else if (item.type === 'transform') {
    correct = equalValue(response, item.modelAnswer);
  } else if (item.type === 'parallelRewrite') {
    const data = recordValue(response);
    const first = String(data.first ?? '');
    const second = String(data.second ?? '');
    detectedPatterns = [...detectPatterns(first), ...detectPatterns(second)];
    const firstOk = normalizeArabic(first).includes(normalizeArabic('قَرَّرْتُ أَنْ'));
    const secondOk = normalizeArabic(second).includes(normalizeArabic('أَحْتَاجُ إِلَى'));
    if (!firstOk) missingRequirements.push('اكتب الجملة الأولى باستعمال «قَرَّرْتُ أَنْ + مضارع».');
    if (!secondOk) missingRequirements.push('اكتب الجملة الثانية باستعمال «أَحْتَاجُ إِلَى + مصدر».');
    correct = firstOk && secondOk && first.length > 12 && second.length > 12;
  } else if (item.type === 'sentenceBuilder') {
    const value = Array.isArray(response) ? response.join(' ') : response;
    correct = equalValue(value, item.answer);
  } else if (item.type === 'cloze') {
    correct = stringArray(response).length === item.blanks.length
      && item.blanks.every((blank: { answer: string }, index: number) => equalValue(stringArray(response)[index], blank.answer));
  } else if (item.type === 'guidedProduction') {
    const text = Array.isArray(response) ? response.join(' ') : String(response ?? '');
    detectedPatterns = detectPatterns(text);
    const sentences = text.split(/[.؟!\n]+/u).filter((entry) => entry.trim());
    const required = ['قَرَّرْتُ أَنْ', 'أَحْتَاجُ إِلَى', 'أَهْتَمُّ بِـ', 'نَجَحْتُ فِي'];
    for (const pattern of required) if (!normalizeArabic(text).includes(normalizeArabic(pattern))) missingRequirements.push(`استعمل «${pattern}».`);
    if (sentences.length < Number(item.minimumSentences || 4)) missingRequirements.push('اكتب أربع جمل كاملة على الأقل.');
    correct = missingRequirements.length === 0;
  } else if (item.type === 'exitTicket') {
    const data = recordValue(response);
    const singular = String(data.singular ?? '');
    const fiveVerb = String(data.fiveVerb ?? '');
    const preposition = String(data.preposition ?? '');
    const singularDetected = /ان[ابتني][\p{L}]+/u.test(normalizeArabic(singular));
    const fiveDetected = /ان[يتن][\p{L}]+وا/u.test(normalizeArabic(fiveVerb)) || /ان[ت][\p{L}]+ي/u.test(normalizeArabic(fiveVerb));
    const prepDetected = /(الى|في|على|ب)[\p{L}]+/u.test(normalizeArabic(preposition));
    detectedPatterns = [singularDetected ? 'أَنْ + مضارع مفرد' : '', fiveDetected ? 'حذف النون' : '', prepDetected ? 'حرف جر + مصدر' : ''].filter(Boolean);
    const patterns = [singularDetected, fiveDetected, prepDetected].filter(Boolean).length * 2;
    const meaning = [singular, fiveVerb, preposition].every((entry) => entry.trim().length >= 8) ? 2 : 0;
    const accuracy = [singular, fiveVerb, preposition].every((entry) => entry.trim().split(/\s+/u).length >= 3) ? 2 : 0;
    rubricScore = { patterns, meaning, accuracy };
    maxScore = 10;
    score = patterns + meaning + accuracy;
    if (!singularDetected) missingRequirements.push('أضف جملة فيها «أَنْ + مضارع مفرد».');
    if (!fiveDetected) missingRequirements.push('أضف فعلًا من الأفعال الخمسة بعد «أَنْ» مع حذف النون.');
    if (!prepDetected) missingRequirements.push('أضف جملة فيها «حرف جر + مصدر».');
    correct = score >= 7 && missingRequirements.length === 0;
  } else if ('answer' in item) {
    correct = equalValue(response, item.answer);
  }

  if (maxScore === 1) score = correct ? 1 : 0;
  return { correct, score, maxScore, detectedPatterns: [...new Set(detectedPatterns)], missingRequirements, rubricScore };
}

function stages() {
  return levelTwoLessonOneGrammarPrivate.exercises.stages as unknown as Array<{ id: string; titleAr: string; titleEn: string; items: PrivateItem[] }>;
}

const allowedExerciseIds: Record<string, Set<string> | null> = {
  notice: null,
  // Stage two is deliberately choice-based: no transformation, correction,
  // matching, sorting, or open writing tasks.
  rule1: new Set(['r01', 'r02', 'r03', 'r08', 'r09']),
  // Keep only selection-based practice for the second rule.
  rule2: new Set(['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p08', 'p09']),
  // One contrast question plus the corrected word-order activity.
  mixed: new Set(['m01', 'm03']),
};

export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get('attempt') || 'default-attempt';
  const lesson = levelTwoLessonOneGrammarPrivate.lesson;
  const examples = levelTwoLessonOneGrammarPrivate.examples.map((example) => ({ ...example, audio: audioPath(example.audio) }));
  const publicStages = stages().map((stage) => {
    const allowed = allowedExerciseIds[stage.id];
    const items = allowed === null ? stage.items : stage.items.filter((item) => allowed?.has(item.id));
    return { ...stage, items: items.map((item) => publicItem(item, attemptId)) };
  });
  return Response.json({ lesson, rules: levelTwoLessonOneGrammarPrivate.rules, examples, stages: publicStages, feedbackPolicy: levelTwoLessonOneGrammarPrivate.exercises.feedbackPolicy }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const item = stages().flatMap((stage) => stage.items).find((entry) => entry.id === body.id);
  if (!item) return Response.json({ error: 'ITEM_NOT_FOUND' }, { status: 404 });
  const attemptNumber = Math.max(1, Math.min(2, Number(body.attemptNumber) || 1));
  const result = gradeItem(item, body.response);
  const reveal = !result.correct && attemptNumber >= 2;
  const ruleHint = item.id.startsWith('r')
    ? 'راجع أثر «أَنْ»: الفتحة في المفرد، وحذف النون في الأفعال الخمسة.'
    : item.id.startsWith('p')
      ? 'بعد حرف الجر نحتاج إلى اسم؛ استعمل المصدر واختر حرف الجر الملازم للتعبير.'
      : 'قارن بين «أَنْ + مضارع» و«حرف الجر + مصدر»، وحدد البنية التي يطلبها السياق.';
  return Response.json({
    ...result,
    reveal,
    feedbackAr: result.correct ? (item.feedbackAr || 'إجابة صحيحة. أحسنت تطبيق القاعدة.') : reveal ? 'هذه محاولتك الثانية. راجع النموذج مع النهاية المتغيرة.' : ruleHint,
    feedbackEn: result.correct ? (item.feedbackEn || 'Correct. You applied the target pattern.') : reveal ? 'This was your second attempt. Review the model and the changed ending.' : 'Review the target rule, then use your second attempt.',
    modelAnswer: reveal ? modelFor(item) : undefined,
  });
}
