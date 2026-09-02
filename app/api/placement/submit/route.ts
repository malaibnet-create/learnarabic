import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { objectiveAnswers } from '../../../../data/placement/private-answers';
import { placementQuestions } from '../../../../data/placement/public-questions';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in to take the placement test.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { responses?: Array<{ questionId:number; value?:number|string; recordingPath?:string }> } | null;
  const responses = body?.responses ?? [];
  if (responses.length !== 25 || new Set(responses.map((item) => item.questionId)).size !== 25) return NextResponse.json({ error: 'Please answer all 25 questions before submitting.' }, { status: 400 });
  const byId = new Map(responses.map((item) => [item.questionId, item]));
  const objectiveIds = Object.keys(objectiveAnswers).map(Number);
  const correct = objectiveIds.filter((id) => byId.get(id)?.value === objectiveAnswers[id]).length;
  const listeningCorrect = objectiveIds.filter((id) => id <= 7 && byId.get(id)?.value === objectiveAnswers[id]).length;
  const readingCorrect = objectiveIds.filter((id) => id >= 8 && byId.get(id)?.value === objectiveAnswers[id]).length;
  const writingReady = [15,16,17,18,19].every((id) => typeof byId.get(id)?.value === 'string' && String(byId.get(id)?.value).trim());
  const speakingReady = [20,21,22,23,24,25].every((id) => byId.get(id)?.recordingPath && byId.get(id)?.recordingPath !== 'pending-upload');
  if (!writingReady || !speakingReady) return NextResponse.json({ error: 'Writing and speaking evaluation are required. Add the OpenAI server key and audio upload configuration before submitting the full assessment.' }, { status: 503 });
  const listeningScore = Math.round((listeningCorrect / 7) * 100);
  const readingScore = Math.round((readingCorrect / 7) * 100);
  const writingScore = 0;
  const speakingScore = 0;
  const recommended = listeningScore >= 70 && readingScore >= 70 ? 'B1' : listeningScore >= 45 || readingScore >= 45 ? 'A2' : 'A1';
  const answers = responses.map(({ questionId, value, recordingPath }) => ({ questionId, value, recordingPath }));
  const { data, error } = await supabase.from('placement_attempts').insert({ user_id:user.id, score:Math.round((listeningScore + readingScore) / 2), recommended_level:recommended, answers, listening_score:listeningScore, reading_score:readingScore, writing_score:writingScore, speaking_score:speakingScore }).select('id').single();
  if (error) return NextResponse.json({ error: 'Could not save your assessment. Run the placement migration in Supabase first.' }, { status: 500 });
  return NextResponse.json({ attemptId: data.id, status: 'pending-ai-evaluation', questionCount: placementQuestions.length });
}
