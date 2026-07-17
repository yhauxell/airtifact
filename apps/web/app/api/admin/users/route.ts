import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminCredential } from '@/lib/session';

interface UserData {
  username: string;
  createdAt: string;
  isBlocked: boolean;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
      return NextResponse.json({ error: 'Admin configuration is not configured' }, { status: 500 });
    }

    const providedPassword = request.headers.get('x-manage-password');
    const cookieValue = request.cookies.get('admin_session')?.value;
    if (!isValidAdminCredential(providedPassword, cookieValue)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 500 });
    }

    const { blobs } = await list({ prefix: 'users/' });
    const users: UserData[] = [];

    for (const blob of blobs) {
      const match = blob.pathname.match(/^users\/([^\/]+)\/profile\.json$/);
      if (match) {
        let isBlocked = false;
        try {
          const res = await fetch(blob.url, { cache: 'no-store' });
          const profile = await res.json();
          isBlocked = !!profile.isBlocked;
        } catch (e) {
          console.error('Failed to fetch profile for', match[1]);
        }
        users.push({
          username: match[1],
          createdAt: blob.uploadedAt.toISOString(),
          isBlocked,
        });
      }
    }

    // Sort by created date, newest first by default
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[v0] Admin users API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
