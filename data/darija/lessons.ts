export type DarijaQuestion = { id: string; prompt: string; options: string[]; correctIndex: number };
export type DarijaLesson = { id: number; title: string; description: string; videoUrl: string | null; questions: DarijaQuestion[] };

const titles = ['التعارف والتحية','الأرقام والأعمار','العائلة','البيت والغرف','الألوان والملابس','الأكل والشرب','في السوق','الأسعار والمساومة','الوقت والمواعيد','الروتين اليومي','الجامعة والدراسة','العمل والمهن','المواصلات','الاتجاهات والأماكن','في المطعم','في المقهى','الصحة والطبيب','الطقس والفصول','الهوايات','الرياضة','السفر','في المطار','الفندق والحجز','التسوق','الهاتف والتواصل','الحياة في المغرب','العادات المغربية','وصف الأشخاص','التعبير عن الرأي','مراجعة شاملة'];

export const darijaLessons: DarijaLesson[] = titles.map((title, index) => ({
  id: index + 1,
  title,
  description: `درس ${index + 1} في الدارجة المغربية. أضف رابط فيديو يوتيوب وأسئلة الدرس عند إعداد المحتوى.`,
  videoUrl: null,
  questions: [
    { id: `${index + 1}-1`, prompt: 'سيظهر سؤال مرتبط بالفيديو هنا.', options: ['الإجابة الأولى','الإجابة الثانية','الإجابة الثالثة','الإجابة الرابعة'], correctIndex: 0 },
    { id: `${index + 1}-2`, prompt: 'سيظهر سؤال الفهم الثاني هنا.', options: ['الإجابة الأولى','الإجابة الثانية','الإجابة الثالثة','الإجابة الرابعة'], correctIndex: 0 },
  ],
}));
