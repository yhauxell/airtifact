import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';

const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 1 week in seconds

export async function GET(request: NextRequest) {
  if (!process.env.MANAGE_PASSWORD) {
    return NextResponse.json(
      { error: 'Manage password is not configured' },
      { status: 500 }
    );
  }

  const cookie = request.cookies.get(SESSION_COOKIE);
  if (!cookie || cookie.value !== process.env.MANAGE_PASSWORD) {
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

    if (!process.env.MANAGE_PASSWORD) {
      console.error('[v0] MANAGE_PASSWORD is not configured');
      return NextResponse.json(
        { error: 'Manage password is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const password =
      typeof body?.password === 'string' ? body.password : undefined;

    if (!password || password !== process.env.MANAGE_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, process.env.MANAGE_PASSWORD, {
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
