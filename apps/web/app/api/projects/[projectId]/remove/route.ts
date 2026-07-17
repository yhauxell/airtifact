import { del, list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import {
  isDeleteTokenMatch,
  isValidDeleteToken,
  isValidProjectId,
  type StoredProjectMetadata,
} from '@/lib/project-removal';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn('[v0] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Blob storage is not configured' },
        { status: 500 }
      );
    }

    const { projectId } = await params;
    if (!isValidProjectId(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!isValidDeleteToken(token)) {
      return NextResponse.json({ error: 'Invalid delete token' }, { status: 400 });
    }

    const { blobs } = await list({
      prefix: `projects/${projectId}/`,
    });

    if (blobs.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const metadataBlob = blobs.find(
      (blob) => blob.pathname === `projects/${projectId}/metadata.json`
    );

    if (!metadataBlob) {
      return NextResponse.json({ error: 'Project metadata not found' }, { status: 404 });
    }

    const metadataResponse = await fetch(metadataBlob.url, { cache: 'no-store' });
    if (!metadataResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to load project metadata' },
        { status: 500 }
      );
    }

    const metadata = (await metadataResponse.json()) as Partial<StoredProjectMetadata> & { owner?: string };
    
    // Check if user is the owner
    const cookieValue = request.cookies.get('auth_session')?.value;
    const sessionUser = require('@/lib/session').validateUserSession(cookieValue);
    const isOwner = sessionUser && metadata.owner === sessionUser;

    if (!isOwner) {
      if (typeof metadata.deleteTokenHash !== 'string') {
        return NextResponse.json(
          { error: 'Project removal is unavailable for this project' },
          { status: 400 }
        );
      }

      if (!isDeleteTokenMatch(token, metadata.deleteTokenHash)) {
        return NextResponse.json({ error: 'Invalid delete token or unauthorized' }, { status: 401 });
      }
    }

    await del(blobs.map((blob) => blob.pathname));

    return NextResponse.json({
      ok: true,
      projectId,
      deletedFiles: blobs.length,
    });
  } catch (error) {
    console.error('[v0] Self-service project deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
