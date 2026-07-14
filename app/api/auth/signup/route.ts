import { NextRequest, NextResponse } from 'next/server';
import { userExists, createUser, hashUserPassword } from '@/lib/user-store';
import { createUserSessionToken } from '@/lib/session';
import { checkBotId } from 'botid/server';

const USER_SESSION_COOKIE = 'auth_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(request: NextRequest) {
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || typeof username !== 'string' || username.length < 3) {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const exists = await userExists(username);
    if (exists) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const passwordHash = hashUserPassword(password);
    await createUser(username, passwordHash);

    const sessionToken = createUserSessionToken(username, SESSION_MAX_AGE);
    if (!sessionToken) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true, username });
    response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
    
    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
