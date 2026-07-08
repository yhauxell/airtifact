import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[v0] Admin auth error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}
