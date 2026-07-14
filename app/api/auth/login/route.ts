import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/user-store';
import { createUserSessionToken } from '@/lib/session';
import { checkBotId } from 'botid/server';
import { scryptSync, timingSafeEqual } from 'crypto';

const USER_SESSION_COOKIE = 'auth_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function verifyUserPassword(password: string, hashString: string): boolean {
  const parts = hashString.split(':');
  if (parts.length !== 2) return false;

  const [salt, storedHash] = parts;
  try {
    const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (derivedKey.length !== storedBuffer.length) return false;
    return timingSafeEqual(derivedKey, storedBuffer);
  } catch (error) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const userProfile = await getUser(username);
    if (!userProfile) {
      // Return same error to prevent username enumeration
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (!verifyUserPassword(password, userProfile.passwordHash)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (userProfile.isBlocked) {
      return NextResponse.json({ error: 'Your account has been blocked.' }, { status: 403 });
    }

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
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}
