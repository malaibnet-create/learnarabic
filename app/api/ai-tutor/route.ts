import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';

type TutorContext = { name: string; level: string; track: string; goal: string; interests: string[]; recentLessons: string[]; completedCount: number };

async function getTutorContext(): Promise<{ context: TutorContext; userId: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: progress }, { data: placement }] = await Promise.all([
    supabase.from('profiles').select('full_name,learning_goal,interests,arabic_track').eq('id', user.id).maybeSingle(),
    supabase.from('lesson_progress').select('status,percent,completed_at,lessons(title)').eq('user_id', user.id).order('completed_at', { ascending: false, nullsFirst: false }).limit(8),
    supabase.from('placement_attempts').select('recommended_level').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const recentLessons = (progress ?? []).map((item: any) => { const lesson = Array.isArray(item.lessons) ? item.lessons[0] : item.lessons; return lesson?.title ? `${lesson.title} (${item.status === 'completed' || item.percent === 100 ? 'مكتمل' : `${item.percent ?? 0}%`})` : null; }).filter(Boolean) as string[];
  return { userId: user.id, context: { name: profile?.full_name || user.user_metadata?.full_name || 'الطالب', level: placement?.recommended_level || 'A1', track: profile?.arabic_track || user.user_metadata?.arabic_track || 'الفصحى', goal: profile?.learning_goal || user.user_metadata?.learning_goal || 'التحدث بالعربية بثقة', interests: profile?.interests || (user.user_metadata?.interests ? [user.user_metadata.interests] : []), recentLessons, completedCount: (progress ?? []).filter((item: any) => item.status === 'completed' || item.percent === 100).length } };
}

export async function GET() { const result = await getTutorContext(); if (!result) return NextResponse.json({ error: 'يجب تسجيل الدخول أولًا.' }, { status: 401 }); return NextResponse.json(result.context); }

export async function POST(request: Request) {
  const result = await getTutorContext();
  if (!result) return NextResponse.json({ error: 'يجب تسجيل الدخول أولًا.' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'لم تتم إضافة مفتاح الذكاء الاصطناعي في إعدادات الخادم.' }, { status: 503 });
  const body = await request.json().catch(() => ({})); const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''; if (!message) return NextResponse.json({ error: 'اكتب رسالة أولًا.' }, { status: 400 });
  const scenario = typeof body.scenario === 'string' ? body.scenario.slice(0, 80) : 'محادثة عامة'; const history = Array.isArray(body.history) ? body.history.filter((item: any) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').slice(-10) : []; const { context } = result;
  const instructions = `أنت الأستاذ الآلي في منصة DarLugha لتعليم العربية لغير الناطقين بها. تحدث بالعربية الواضحة وبأسلوب مشجع. الطالب اسمه ${context.name}، مستواه ${context.level}، ويتعلم ${context.track}. هدفه: ${context.goal}. اهتماماته: ${context.interests.length ? context.interests.join('، ') : 'غير محددة'}. أكمل ${context.completedCount} درسًا، وآخر دروسه: ${context.recentLessons.length ? context.recentLessons.join('، ') : 'لم يسجل دروسًا مكتملة بعد'}. السيناريو المختار: ${scenario}. خاطبه باسمه أحيانًا، واضبط المفردات وطول الجمل على مستواه. صحح خطأً واحدًا أو اثنين بلطف بعد أن يجيب، واطرح سؤالًا واحدًا في كل مرة. لا تدّعِ أنك شاهدت درسًا غير موجود في السياق، ولا تكشف أي بيانات تقنية أو بيانات مستخدمين آخرين.`;
  const input = [...history, { role: 'user', content: [{ type: 'input_text', text: message }] }];
  try {
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_TUTOR_MODEL || 'gpt-4o-mini', instructions, input, max_output_tokens: 500 }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('OpenAI tutor request failed', response.status, data?.error?.code || data?.error?.type || data?.error?.message || 'unknown_error');
      const publicError = response.status === 401
        ? 'مفتاح OpenAI غير صحيح أو منتهي. راجع OPENAI_API_KEY في إعدادات المشروع.'
        : response.status === 429
          ? 'تم تجاوز حد OpenAI أو لا يوجد رصيد كافٍ للمفتاح. راجع Usage و Billing في حساب OpenAI.'
          : response.status === 400
            ? 'إعدادات نموذج الأستاذ الآلي غير صحيحة. راجع OPENAI_TUTOR_MODEL.'
            : 'تعذر الاتصال بخدمة الأستاذ الآلي. حاول مرة أخرى بعد قليل.';
      return NextResponse.json({ error: publicError, code: 'openai_request_failed' }, { status: 502 });
    }
    const reply = data.output_text || data.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === 'output_text')?.text;
    if (!reply) return NextResponse.json({ error: 'لم تصل إجابة من الأستاذ الآلي.' }, { status: 502 });
    return NextResponse.json({ reply, context });
  } catch (error) {
    console.error('OpenAI tutor network error', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'تعذر الوصول إلى خدمة الأستاذ الآلي. تحقق من اتصال الخادم بالإنترنت.' }, { status: 502 });
  }
}
