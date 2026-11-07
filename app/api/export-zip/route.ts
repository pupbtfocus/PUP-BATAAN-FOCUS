import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createClient } from '@/lib/auth/with-auth';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limitResult = rateLimit(`export-zip:${ip}`, {
    intervalMs: 60000,
    maxRequests: 3,
  });

  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(limitResult.limit),
    'X-RateLimit-Remaining': String(limitResult.remaining),
    'Retry-After': String(limitResult.resetInSeconds),
  };

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: rateLimitHeaders }
    );
  }

  // TODO: Implement JSZip archive generation and file streaming logic here

  return NextResponse.json(
    { success: true, message: 'ZIP export ready.' },
    { status: 200, headers: rateLimitHeaders }
  );
}

