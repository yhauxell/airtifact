import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const cookieValue = request.cookies.get('auth_session')?.value;
    const username = validateUserSession(cookieValue);

    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'Blob storage is not configured' }, { status: 500 });
    }

    const { blobs } = await list({ prefix: 'projects/' });

    const metadataPromises = blobs
      .filter((blob) => blob.pathname.endsWith('/metadata.json'))
      .map(async (blob) => {
        try {
          const res = await fetch(blob.url, { cache: 'no-store' });
          if (!res.ok) return null;
          const data = await res.json();
          return { ...data, _url: blob.url, _pathname: blob.pathname };
        } catch {
          return null;
        }
      });

    const allMetadata = await Promise.all(metadataPromises);

    const userProjects = allMetadata.filter(
      (m) => m && m.owner === username
    );

    return NextResponse.json({ projects: userProjects });
  } catch (error) {
    console.error('List user projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
