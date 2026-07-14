import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { createSessionToken, isValidAdminCredential, verifyPassword } from '@/lib/session';

const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 1 week in seconds

export async function GET(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: 'Admin configuration is missing' },
      { status: 500 }
    );
  }

  const cookie = request.cookies.get(SESSION_COOKIE);
  if (!isValidAdminCredential(null, cookie?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
      console.error('[v0] Admin configuration is missing');
      return NextResponse.json(
        { error: 'Admin configuration is missing' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : undefined;

    if (!password || !verifyPassword(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const sessionToken = createSessionToken(SESSION_MAX_AGE);
    if (!sessionToken) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (error) {
    console.error('[v0] Admin auth error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}
