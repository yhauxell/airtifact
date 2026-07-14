import { list, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminCredential } from '@/lib/session';
import { getUser, updateUser, deleteUser } from '@/lib/user-store';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const providedPassword = request.headers.get('x-manage-password');
    const cookieValue = request.cookies.get('admin_session')?.value;
    if (!isValidAdminCredential(providedPassword, cookieValue)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (typeof body.isBlocked !== 'boolean') {
      return NextResponse.json({ error: 'Invalid isBlocked value' }, { status: 400 });
    }

    const profile = await getUser(username);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    profile.isBlocked = body.isBlocked;
    await updateUser(profile);

    return NextResponse.json({ ok: true, isBlocked: profile.isBlocked });
  } catch (error) {
    console.error('[v0] User PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const providedPassword = request.headers.get('x-manage-password');
    const cookieValue = request.cookies.get('admin_session')?.value;
    if (!isValidAdminCredential(providedPassword, cookieValue)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getUser(username);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Delete user profile
    await deleteUser(username);

    // 2. Find and delete all user's projects
    const { blobs } = await list({ prefix: 'projects/' });
    const metadataBlobs = blobs.filter(b => b.pathname.endsWith('/metadata.json'));
    
    let deletedProjectsCount = 0;

    for (const metadataBlob of metadataBlobs) {
      try {
        const response = await fetch(metadataBlob.url);
        const metadata = await response.json();
        
        if (metadata.owner === username) {
          // Delete all blobs for this project
          const projectBlobs = blobs.filter(b => b.pathname.startsWith(`projects/${metadata.projectId}/`));
          await del(projectBlobs.map(b => b.pathname));
          deletedProjectsCount++;
        }
      } catch (err) {
        console.error(`Error processing metadata for deletion: ${metadataBlob.pathname}`, err);
      }
    }

    return NextResponse.json({ ok: true, deletedProjectsCount });
  } catch (error) {
    console.error('[v0] User DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
