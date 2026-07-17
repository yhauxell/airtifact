import { NextRequest, NextResponse } from 'next/server';
import { validateUserSession, generateUserApiKey } from '@/lib/session';
import { getUser, updateUser } from '@/lib/user-store';

export async function POST(request: NextRequest) {
  try {
    const cookieValue = request.cookies.get('auth_session')?.value;
    const username = validateUserSession(cookieValue);

    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUser(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Increment version to revoke previous keys
    user.apiKeyVersion += 1;
    await updateUser(user);

    const apiKey = generateUserApiKey(username, user.apiKeyVersion);
    if (!apiKey) {
      return NextResponse.json({ error: 'Failed to generate API Key' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, apiKey });
  } catch (error) {
    console.error('API Key generation error:', error);
    return NextResponse.json({ error: 'Failed to generate API Key' }, { status: 500 });
  }
}
