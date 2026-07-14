import { del, list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { isValidAdminCredential } from '@/lib/session';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
      console.error('[v0] Admin configuration is not configured');
      return NextResponse.json(
        { error: 'Admin configuration is not configured' },
        { status: 500 }
      );
    }

    const providedPassword = request.headers.get('x-manage-password');
    const cookieValue = request.cookies.get('admin_session')?.value;
    if (!isValidAdminCredential(providedPassword, cookieValue)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn('[v0] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Blob storage is not configured' },
        { status: 500 }
      );
    }

    const { projectId } = await params;
    if (!/^[a-f0-9]{32}$/.test(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const { blobs } = await list({
      prefix: `projects/${projectId}/`,
    });

    if (blobs.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await del(blobs.map((blob) => blob.pathname));

    return NextResponse.json({
      ok: true,
      deletedFiles: blobs.length,
      projectId,
    });
  } catch (error) {
    console.error('[v0] Project deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
