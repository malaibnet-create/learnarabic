import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';

const allowedTimes = ['09:00', '10:00', '11:00', '12:00'];

function getSessionDate(startDate: string, weekday: number, week: number) {
  const date = new Date(`${startDate}T12:00:00`); const current = (date.getDay() + 6) % 7; const offset = (weekday - current + 7) % 7; date.setDate(date.getDate() + offset + week * 7); return date.toISOString().slice(0, 10);
}

async function getClient() { return createServerSupabaseClient(); }

export async function GET() {
  const supabase = await getClient(); const { data, error } = await supabase.from('teachers').select('id,slug,full_name,email,bio,photo_url,skills,tracks').eq('active', true).order('full_name');
  if (error) return NextResponse.json({ error: 'تعذر تحميل قائمة المدرسين.' }, { status: 500 }); return NextResponse.json({ teachers: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await getClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول قبل الحجز.' }, { status: 401 });
  const body = await request.json().catch(() => ({})); const teacherId = typeof body.teacherId === 'string' ? body.teacherId : ''; const lessonType = body.lessonType === 'group' ? 'group' : 'individual'; const skill = typeof body.skill === 'string' ? body.skill : ''; const startDate = typeof body.startDate === 'string' ? body.startDate : ''; const timezone = typeof body.timezone === 'string' ? body.timezone.slice(0, 80) : 'Africa/Casablanca'; const frequency = Number(body.weeklyFrequency); const weeks = Number(body.weeksCount); const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1200) : ''; const slots = Array.isArray(body.slots) ? body.slots : [];
  if (!teacherId || !skill || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || ![1,2,3].includes(frequency) || ![1,4,8,12].includes(weeks) || slots.length !== frequency) return NextResponse.json({ error: 'أكمل بيانات الحجز واختيار الأوقات.' }, { status: 400 });
  const cleanSlots = slots.map((slot: any) => ({ weekday: Number(slot.weekday), time: String(slot.time) })).filter((slot: any) => Number.isInteger(slot.weekday) && slot.weekday >= 0 && slot.weekday <= 6 && allowedTimes.includes(slot.time)); if (cleanSlots.length !== frequency) return NextResponse.json({ error: 'تأكد من صحة الأيام والساعات.' }, { status: 400 });
  const { data: teacher } = await supabase.from('teachers').select('id,full_name,email').eq('id', teacherId).eq('active', true).maybeSingle(); if (!teacher) return NextResponse.json({ error: 'الأستاذ غير متاح.' }, { status: 400 });
  const { data: booking, error: bookingError } = await supabase.from('bookings').insert({ student_id: user.id, teacher_id: teacher.id, lesson_type: lessonType, skill, start_date: startDate, timezone, weekly_frequency: frequency, weeks_count: weeks, notes }).select('id').single(); if (bookingError) return NextResponse.json({ error: 'تعذر حفظ طلب الحجز.' }, { status: 500 });
  const sessions = Array.from({ length: weeks }).flatMap((_, week) => cleanSlots.map((slot: any) => ({ booking_id: booking.id, scheduled_date: getSessionDate(startDate, slot.weekday, week), start_time: slot.time, end_time: `${String(Number(slot.time.slice(0,2)) + 1).padStart(2,'0')}:00` })));
  const { error: sessionsError } = await supabase.from('booking_sessions').insert(sessions); if (sessionsError) return NextResponse.json({ error: 'حُفظ الطلب لكن تعذر إنشاء مواعيده.' }, { status: 500 });
  let emailSent = false;
  if (teacher.email && process.env.RESEND_API_KEY && process.env.BOOKING_FROM_EMAIL) { const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(); const emailResponse = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, body: JSON.stringify({ from: process.env.BOOKING_FROM_EMAIL, to: [teacher.email], subject: `طلب حجز جديد معك في DarLugha`, html: `<h2>طلب حجز جديد</h2><p>قام الطالب <strong>${profile?.full_name || user.email}</strong> بإرسال طلب حجز معك.</p><p>المهارة: ${skill}<br>نوع الدرس: ${lessonType === 'group' ? 'جماعي' : 'فردي'}<br>البداية: ${startDate}<br>عدد الدروس أسبوعيًا: ${frequency}<br>المدة: ${weeks} أسبوعًا</p><p>ملاحظات الطالب: ${notes || 'لا توجد ملاحظات'}</p>` }) }); emailSent = emailResponse.ok; }
  return NextResponse.json({ bookingId: booking.id, emailSent, message: emailSent ? 'تم إرسال طلب الحجز وإشعار الأستاذ.' : 'تم حفظ طلب الحجز، وسيتم تفعيل إشعار البريد بعد إعداد خدمة البريد.' });
}
