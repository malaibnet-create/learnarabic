import { levelTwoLessonOneListeningPrivate } from '../../../data/level2/listening-private';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PrivateItem = Record<string, any> & {
  id: string;
  type: string;
  promptAr: string;
  promptEn: string;
};

const AUDIO_ROOT = '/audio/level-02/lesson-01/listening/';
const IMAGE_ROOT = '/images/level-02/lesson-01/listening/';
const objectiveStageIds = new Set(['gist', 'details', 'language', 'inference']);

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

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function detectTargetVocabulary(value: unknown) {
  const text = compact(value);
  const families = levelTwoLessonOneListeningPrivate.vocabulary as unknown as Array<Record<string, string>>;
  return families
    .filter((family) => [family.headwordAr, family.past, family.present, family.masdar, family.activeParticiple, family.passiveParticiple]
      .filter(Boolean)
      .map(compact)
      .filter((entry) => entry.length >= 3)
      .some((alias) => text.includes(alias)))
    .map((family) => family.headwordAr);
}

function audioPath(path: string) {
  return `${AUDIO_ROOT}${path.split('/').pop()}`;
}

function imagePath(path: string) {
  return `${IMAGE_ROOT}${path.split('/').pop()}`;
}

function publicItem(item: PrivateItem, attemptId: string) {
  const {
    answer: _answer,
    answers: _answers,
    correctionAr: _correctionAr,
    modelAnswerAr: _modelAnswerAr,
    requiredAny: _requiredAny,
    ...safe
  } = item;
  if (Array.isArray(item.choices)) safe.choices = shuffle(item.choices, `${attemptId}-${item.id}-choices`);
  if (Array.isArray(item.events)) safe.events = shuffle(item.events, `${attemptId}-${item.id}-events`);
  if (item.type === 'trueFalse') safe.choices = ['صحيح', 'خطأ'];
  if (typeof item.audio === 'string') safe.audio = audioPath(item.audio);
  if (typeof item.image === 'string') safe.image = imagePath(item.image);
  if (item.type === 'summaryBuilder' || item.type === 'solutionTask') {
    safe.targetVocabulary = levelTwoLessonOneListeningPrivate.listening.targetVocabulary;
  }
  return safe;
}

function gradeItem(item: PrivateItem, response: unknown) {
  let correct = false;
  let detectedTerms: string[] = [];
  let missingRequirements: string[] = [];
  let rubricScore: Record<string, number> | undefined;

  if (item.type === 'imageObservation') {
    correct = wordCount(response) >= 4;
    if (!correct) missingRequirements = ['اذكر دليلين واضحين من الصورة.'];
  } else if (item.type === 'predictionChoice' || item.type === 'predictionOpen' || item.type === 'keyWords') {
    correct = Boolean(String(response ?? '').trim());
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
    correct = stringArray(item.requiredAny).some((entry) => normalized.includes(normalizeArabic(entry)));
    if (!correct) missingRequirements = ['أضف دليلًا محددًا مما سمعته.'];
  } else if (item.type === 'summaryBuilder') {
    const data = response && typeof response === 'object' ? response as Record<string, unknown> : {};
    const parts = ['goal', 'activities', 'problems', 'success'];
    const combined = parts.map((part) => String(data[part] ?? '')).join(' ');
    const completedParts = parts.filter((part) => String(data[part] ?? '').trim()).length;
    detectedTerms = detectTargetVocabulary(combined);
    if (completedParts < 4) missingRequirements.push('أكمل جمل الملخص الأربع.');
    if (detectedTerms.length < Number(item.minimumTargetVocabulary || 4)) missingRequirements.push(`استعمل ${item.minimumTargetVocabulary || 4} كلمات من الدرس.`);
    correct = missingRequirements.length === 0;
  } else if (item.type === 'solutionTask') {
    const data = response && typeof response === 'object' ? response as Record<string, unknown> : {};
    const isRecording = data.mode === 'audio' && data.hasRecording === true && Number(data.durationSeconds || 0) >= 10;
    if (isRecording) {
      correct = true;
    } else {
      const text = typeof response === 'string' ? response : String(data.text ?? '');
      const words = wordCount(text);
      const normalized = normalizeArabic(text);
      detectedTerms = detectTargetVocabulary(text);
      const scenarioSignals = [/(20|عشرين).*متعلم/u.test(normalized), /(6|سته).*حواسيب?/u.test(normalized), /ساعه/u.test(normalized), /ازواج|مجموع/u.test(normalized)].filter(Boolean).length;
      const connector = /ثم|لذلك|لكن|بعد|اولا|اخيرا/u.test(normalized);
      const sentenceCount = text.split(/[.!؟\n]+/u).filter((entry) => entry.trim()).length;
      rubricScore = {
        solution: Math.min(3, scenarioSignals),
        organization: Number(words >= Number(item.minimumWords || 60) && words <= Number(item.maximumWords || 80)) + Number(connector),
        vocabulary: Math.min(3, Math.round((detectedTerms.length / Number(item.minimumTargetVocabulary || 5)) * 3)),
        accuracy: Number(words >= 40) + Number(sentenceCount >= 3),
      };
      if (words < Number(item.minimumWords || 60) || words > Number(item.maximumWords || 80)) missingRequirements.push(`اكتب بين ${item.minimumWords} و${item.maximumWords} كلمة.`);
      if (detectedTerms.length < Number(item.minimumTargetVocabulary || 5)) missingRequirements.push(`استعمل ${item.minimumTargetVocabulary} كلمات من الدرس.`);
      if (scenarioSignals < 3) missingRequirements.push('عالج عدد المتعلمين والحواسيب والوقت وطريقة العمل.');
      correct = missingRequirements.length === 0 && Object.values(rubricScore).reduce((sum, score) => sum + score, 0) >= 7;
    }
  } else if (item.type === 'reflection') {
    const normalized = normalizeArabic(response);
    const reasonSignals = (normalized.match(/لان|بسبب|والسبب|ايضا|كذلك|اولا|ثانيا/gu) || []).length;
    if (wordCount(response) < 14) missingRequirements.push('اذكر القرار واشرح سببين واضحين.');
    if (reasonSignals < Number(item.minimumReasons || 2)) missingRequirements.push('استعمل عبارتين تدلان على السببين.');
    correct = missingRequirements.length === 0;
  } else if ('answer' in item) {
    correct = equalValue(response, item.answer);
  }

  return { correct, detectedTerms, missingRequirements, rubricScore };
}

function modelAnswer(item: PrivateItem) {
  if (item.type === 'imageObservation') return 'يبدو أنهما يخططان لورشة تعليمية؛ نرى حاسوبًا وتقويمًا وأجهزة لوحية.';
  if (item.type === 'predictionOpen') return 'يمكن تقسيم المشاركين إلى أزواج أو مجموعات صغيرة تتناوب على الأجهزة.';
  if (item.type === 'keyWords') return 'الكلمات ترتبط بتدريب عملي يشارك فيه متعلمون ويستعملون أجهزة لوحية.';
  if (item.modelAnswerAr) return item.modelAnswerAr;
  if (item.correctionAr && item.answer === false) return item.correctionAr;
  if (item.answers) return item.answers;
  if (item.answer !== undefined) return item.answer;
  if (item.type === 'summaryBuilder') return 'اكتب جملة عن هدف الورشة، وجملة عن الأنشطة، وجملة عن المشكلتين، وجملة عن معيار النجاح.';
  return undefined;
}

function privateStages() {
  return levelTwoLessonOneListeningPrivate.exercises.stages as unknown as Array<{ id: string; titleAr: string; titleEn: string; audio?: string; items: PrivateItem[] }>;
}

export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get('attempt') || 'default-attempt';
  const lesson = levelTwoLessonOneListeningPrivate.lesson;
  const listening = levelTwoLessonOneListeningPrivate.listening;
  const stages = privateStages().map((stage) => ({
    id: stage.id,
    titleAr: stage.titleAr,
    titleEn: stage.titleEn,
    audio: stage.audio ? audioPath(stage.audio) : undefined,
    items: stage.items.map((item) => publicItem(item, attemptId)),
  }));
  return Response.json({
    lesson: {
      id: lesson.id,
      titleAr: lesson.titleAr,
      titleEn: lesson.titleEn,
      estimatedMinutes: lesson.estimatedMinutes,
      openingImage: { ...lesson.openingImage, path: imagePath(lesson.openingImage.path) },
      objectivesAr: lesson.objectivesAr,
      objectivesEn: lesson.objectivesEn,
      policy: lesson.policy,
    },
    listening: {
      titleAr: listening.titleAr,
      titleEn: listening.titleEn,
      fullAudio: audioPath(listening.fullAudio),
      segments: listening.segments.map((segment) => ({ id: segment.id, audio: audioPath(segment.audio) })),
      targetVocabulary: listening.targetVocabulary,
    },
    stages,
    feedbackPolicy: levelTwoLessonOneListeningPrivate.exercises.feedbackPolicy,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.mode === 'transcript') {
    const requiredIds = privateStages().filter((stage) => objectiveStageIds.has(stage.id)).flatMap((stage) => stage.items.map((item) => item.id));
    const submittedIds = new Set(stringArray(body.submittedIds));
    if (!requiredIds.every((id) => submittedIds.has(id))) return Response.json({ error: 'OBJECTIVE_STAGES_INCOMPLETE' }, { status: 403 });
    const listening = levelTwoLessonOneListeningPrivate.listening;
    return Response.json({
      speakers: listening.speakers.map(({ id, nameAr, roleAr }) => ({ id, nameAr, roleAr })),
      turns: listening.turns.map(({ id, speaker, displayAr }) => ({ id, speaker, displayAr })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const item = privateStages().flatMap((stage) => stage.items).find((entry) => entry.id === id);
  if (!item) return Response.json({ error: 'ITEM_NOT_FOUND' }, { status: 404 });

  const attemptNumber = Math.max(1, Math.min(2, Number(body.attemptNumber) || 1));
  const result = gradeItem(item, body.response);
  const participation = ['predictionChoice', 'predictionOpen', 'keyWords'].includes(item.type);
  const reveal = !result.correct && !participation && attemptNumber >= 2;
  const feedbackAr = participation
    ? 'حُفظ توقّعك للمقارنة بعد الاستماع.'
    : result.correct
      ? item.type === 'solutionTask' && typeof body.response === 'object' && body.response?.mode === 'audio'
        ? 'حُفظ تسجيلك بنجاح. يمكنك الاستماع إليه في هذه الصفحة.'
        : 'إجابة صحيحة. أحسنت الاستماع والاستدلال.'
      : reveal
        ? 'راجع الدليل أو النموذج، ثم أضف النشاط إلى المراجعة.'
        : 'ليست الإجابة دقيقة بعد. استمع مرة أخرى وحاول محاولة ثانية.';
  const feedbackEn = participation
    ? 'Your prediction is saved for comparison after listening.'
    : result.correct
      ? 'Correct. Your answer is supported by the listening.'
      : reveal
        ? 'Review the evidence or model, then add the activity to review.'
        : 'Not quite. Listen again and use your second attempt.';

  return Response.json({
    correct: result.correct || participation,
    feedbackAr,
    feedbackEn,
    reveal,
    modelAnswer: reveal ? modelAnswer(item) : undefined,
    detectedTerms: result.detectedTerms,
    missingRequirements: result.missingRequirements,
    rubricScore: result.rubricScore,
  });
}
