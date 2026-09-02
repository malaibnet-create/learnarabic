import { levelTwoLessonOneVocabularyPrivate } from '../../../data/level2/vocabulary-private';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PrivateItem = Record<string, any>;

function seededNumber(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], seed: string) {
  const output = [...items];
  const random = seededNumber(seed);
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function audioUrl(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return `/audio/level-02/lesson-01/vocabulary/${value.split('/').pop()}`;
}

function publicItem(item: PrivateItem, attemptId: string) {
  const common: Record<string, unknown> = {
    id: item.id,
    type: item.type,
    promptAr: item.promptAr,
    promptEn: item.promptEn,
    audio: audioUrl(item.audio),
  };
  if (Array.isArray(item.choices)) common.choices = shuffle(item.choices, `${attemptId}:${item.id}:choices`);
  if (Array.isArray(item.pairs)) {
    common.left = shuffle(item.pairs.map((pair: string[]) => pair[0]), `${attemptId}:${item.id}:left`);
    common.right = shuffle(item.pairs.map((pair: string[]) => pair[1]), `${attemptId}:${item.id}:right`);
  }
  if (item.groups) {
    common.groupNames = Object.keys(item.groups);
    common.terms = shuffle(Object.values(item.groups).flat(), `${attemptId}:${item.id}:terms`);
  }
  if (Array.isArray(item.tokens)) common.tokens = shuffle(item.tokens, `${attemptId}:${item.id}:tokens`);
  for (const key of ['requiredTerms', 'requiredAny', 'requiredCount', 'targetTerms', 'starters', 'minimumSentences', 'minimumWords', 'maximumWords', 'minimumTargetTerms', 'rubric']) {
    if (item[key] !== undefined) common[key] = item[key];
  }
  return common;
}

function normalizeArabic(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[^\u0621-\u064a0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function sameText(left: unknown, right: unknown) {
  return normalizeArabic(String(left || '')) === normalizeArabic(String(right || ''));
}

function detectedTargets(text: string, targets: readonly string[]) {
  const normalized = normalizeArabic(text).replace(/\s+/gu, '');
  return targets.filter((target) => normalized.includes(normalizeArabic(target).replace(/\s+/gu, '')));
}

function modelAnswer(item: PrivateItem) {
  if (item.answer !== undefined) return item.answer;
  if (Array.isArray(item.acceptedAnswers)) return item.acceptedAnswers[0];
  if (item.modelAnswer) return item.modelAnswer;
  if (Array.isArray(item.pairs)) return item.pairs.map((pair: string[]) => `${pair[0]} ← ${pair[1]}`).join(' · ');
  if (item.groups) return Object.entries(item.groups).map(([group, terms]) => `${group}: ${(terms as string[]).join('، ')}`).join(' · ');
  if (item.type === 'guidedResponse') return item.starters.join(' … / ');
  if (item.type === 'miniTask') return 'نص من 60 إلى 80 كلمة يستعمل ست كلمات مستهدفة على الأقل ويذكر المهارة والسبب والخطة والمساعدة.';
  return 'راجع متطلبات المهمة ثم أعد المحاولة.';
}

function grade(item: PrivateItem, response: unknown) {
  let correct = false;
  let detected: string[] = [];
  let rubricScore: Record<string, number> | undefined;

  if (['singleChoice', 'audioChoice', 'contextMeaning', 'fillBlank', 'audioComprehension', 'oddOneOut'].includes(item.type)) {
    correct = String(response || '') === String(item.answer || '');
  } else if (item.type === 'typedRecall' || item.type === 'transform') {
    const accepted = item.acceptedAnswers || (item.modelAnswer ? [item.modelAnswer] : []);
    correct = accepted.some((answer: string) => sameText(response, answer));
  } else if (item.type === 'match') {
    const submitted = response && typeof response === 'object' ? response as Record<string, string> : {};
    correct = item.pairs.every((pair: string[]) => submitted[pair[0]] === pair[1]);
  } else if (item.type === 'familySort') {
    const submitted = response && typeof response === 'object' ? response as Record<string, string> : {};
    correct = Object.entries(item.groups).every(([group, terms]) => (terms as string[]).every((term) => submitted[term] === group));
  } else if (item.type === 'sentenceBuilder') {
    correct = sameText(response, item.answer);
  } else if (item.type === 'shortAnswer') {
    const text = String(response || '');
    if (item.requiredAny) {
      detected = detectedTargets(text, item.requiredAny);
      correct = detected.length >= 1;
    } else {
      detected = detectedTargets(text, item.targetTerms || []);
      correct = detected.length >= Number(item.requiredCount || 1);
    }
  } else if (item.type === 'guidedResponse') {
    const text = String(response || '').trim();
    const segments = text.split(/[\n.!؟]+/u).filter((segment) => segment.trim().length >= 3);
    detected = detectedTargets(text, ['اهتم', 'قررت', 'احتاج']);
    correct = segments.length >= Number(item.minimumSentences || 3) && detected.length >= 3;
  } else if (item.type === 'miniTask') {
    const text = String(response || '').trim();
    const words = text ? text.split(/\s+/u).length : 0;
    const targets = ['تعلم', 'تعليم', 'دراسة', 'عمل', 'مشاركة', 'تخطيط', 'قرار', 'اختيار', 'استعمال', 'مساعدة', 'احتياج', 'تواصل', 'اهتمام', 'تغير', 'تطور', 'نجاح'];
    detected = detectedTargets(text, targets);
    const sentences = text.split(/[.!؟\n]+/u).filter((part) => part.trim().length >= 4).length;
    const task = words >= item.minimumWords && words <= item.maximumWords ? 3 : words >= 45 ? 2 : words >= 20 ? 1 : 0;
    const vocabulary = detected.length >= 6 ? 4 : detected.length >= 4 ? 3 : detected.length >= 2 ? 2 : detected.length ? 1 : 0;
    const clarity = sentences >= 3 ? 2 : sentences >= 2 ? 1 : 0;
    const accuracy = words >= 20 ? 1 : 0;
    rubricScore = { task, vocabulary, clarity, accuracy };
    correct = task + vocabulary + clarity + accuracy >= 7 && detected.length >= item.minimumTargetTerms;
  } else if (item.type === 'transform' && item.requiredTerms) {
    detected = detectedTargets(String(response || ''), item.requiredTerms);
    correct = detected.length === item.requiredTerms.length;
  }

  if (item.type === 'transform' && item.requiredTerms && !item.acceptedAnswers) {
    detected = detectedTargets(String(response || ''), item.requiredTerms);
    correct = detected.length === item.requiredTerms.length;
  }

  return { correct, detected, rubricScore };
}

export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get('attempt') || 'default-attempt';
  const stages = levelTwoLessonOneVocabularyPrivate.exercises.stages.map((stage) => ({
    id: stage.id,
    titleAr: stage.titleAr,
    titleEn: stage.titleEn,
    items: stage.items.map((item) => publicItem(item, attemptId)),
  }));
  return Response.json({ stages, feedbackPolicy: levelTwoLessonOneVocabularyPrivate.exercises.feedbackPolicy }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const privateStages = levelTwoLessonOneVocabularyPrivate.exercises.stages as unknown as Array<{ items: PrivateItem[] }>;
  const item = privateStages.flatMap((stage) => stage.items).find((entry) => entry.id === id);
  if (!item) return Response.json({ error: 'ITEM_NOT_FOUND' }, { status: 404 });
  const attemptNumber = Math.max(1, Math.min(2, Number(body.attemptNumber) || 1));
  const result = grade(item, body.response);
  const reveal = !result.correct && attemptNumber >= 2;
  const feedbackAr = item.feedbackAr || (result.correct ? 'إجابة صحيحة. أحسنت.' : reveal ? 'راجع النموذج ثم أضف هذا العنصر إلى المراجعة.' : 'الإجابة غير صحيحة. حاول مرة أخرى.');
  const feedbackEn = item.feedbackEn || (result.correct ? 'Correct. Well done.' : reveal ? 'Review the model answer and add this item to review.' : 'Not correct yet. Try one more time.');
  return Response.json({
    correct: result.correct,
    feedbackAr,
    feedbackEn,
    reveal,
    modelAnswer: reveal ? modelAnswer(item) : undefined,
    detectedTerms: result.detected,
    rubricScore: result.rubricScore,
  });
}
