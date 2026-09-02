import LessonOneExam from '../../../../components/lesson1/LessonOneExam';
import LessonTwoExam from '../../../../components/lesson2/LessonTwoExam';

export default async function LessonExamPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (lessonId === '2') return <LessonTwoExam />;
  if (lessonId !== '1') return <main className="shell"><section className="exam-panel"><h1>لا يوجد امتحان لهذا الدرس بعد.</h1><a className="button" href={`/lessons/${lessonId}`}>العودة إلى الدرس</a></section></main>;
  return <LessonOneExam />;
}
