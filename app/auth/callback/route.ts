import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) await (await createServerSupabaseClient()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL('/welcome', url.origin));
}
