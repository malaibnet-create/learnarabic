import 'server-only';
import { examQuestions, lessonExam } from '../data/level2/final-exam-private';
import { countExamWords, determineExamStatus, listeningPlayMayCount } from './level2-exam-rules.mjs';

export { countExamWords, determineExamStatus, listeningPlayMayCount };

export type ExamSectionId = 'vocabulary' | 'reading' | 'listening' | 'grammar' | 'writing' | 'speaking';

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

export function createPublicExam(attemptId: string) {
  return {
    exam: lessonExam.exam,
    reading: lessonExam.reading,
    listening: {
      titleAr: lessonExam.listening.titleAr,
      audio: '/audio/level-02/lesson-01/exam/exam-listening-full.mp3',
      policy: lessonExam.listening.policy,
    },
    writing: lessonExam.writing,
    speaking: lessonExam.speaking,
    questions: examQuestions.questions.map((question) => ({
      id: question.id,
      section: question.section,
      type: question.type,
      points: question.points,
      promptAr: question.promptAr,
      options: shuffle(question.options, `${attemptId}:${question.id}`),
    })),
  };
}

export function scoreObjectiveAnswers(answers: Record<string, string>) {
  const sectionScores: Record<string, number> = { vocabulary: 0, reading: 0, listening: 0, grammar: 0 };
  const feedback = examQuestions.questions.map((question) => {
    const correctAnswer = question.options[question.answer];
    const selectedAnswer = typeof answers[question.id] === 'string' ? answers[question.id] : '';
    const correct = selectedAnswer === correctAnswer;
    if (correct) sectionScores[question.section] += question.points;
    return {
      id: question.id, section: question.section, correct, points: correct ? question.points : 0,
      maxPoints: question.points, selectedAnswer, correctAnswer,
      feedbackAr: question.feedbackAr, feedbackEn: question.feedbackEn,
    };
  });
  return { sectionScores, feedback, total: Object.values(sectionScores).reduce((sum, score) => sum + score, 0) };
}

export const finalExamPrivate = lessonExam;
