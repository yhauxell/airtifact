import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminCredential } from '@/lib/session';

interface ProjectMetadata {
  projectId: string;
  uploadDate: string;
  fileName: string;
  fileCount: number;
  files: string[];
  size: number;
  owner?: string;
  isBlocked?: boolean;
}

export async function GET(request: NextRequest) {
  try {
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

    // Check if Blob token is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn('[v0] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json({ projects: [] });
    }

    const { blobs } = await list({ prefix: 'projects/' });

    const projectsMap = new Map<string, ProjectMetadata>();

    // Fetch blocked users efficiently
    const usersList = await list({ prefix: 'users/' });
    const blockedUsers = new Set<string>();
    
    for (const blob of usersList.blobs) {
      if (blob.pathname.endsWith('/profile.json')) {
        try {
          const res = await fetch(blob.url, { cache: 'no-store' });
          const profile = await res.json();
          if (profile.isBlocked) {
            const match = blob.pathname.match(/^users\/([^\/]+)\/profile\.json$/);
            if (match) blockedUsers.add(match[1]);
          }
        } catch (e) {}
      }
    }

    // Process all blobs to build project metadata
    for (const blob of blobs) {
      const match = blob.pathname.match(/^projects\/([a-f0-9]+)\/(.+)$/);
      if (!match) continue;

      const [, projectId, filePath] = match;

      // Skip metadata file for now (we'll fetch it separately)
      if (filePath === 'metadata.json') {
        if (!projectsMap.has(projectId)) {
          projectsMap.set(projectId, {
            projectId,
            uploadDate: new Date().toISOString(),
            fileName: 'unknown',
            fileCount: 0,
            files: [],
            size: 0,
          });
        }
        projectsMap.get(projectId)!.size += blob.size;
        continue;
      }

      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, {
          projectId,
          uploadDate: new Date().toISOString(),
          fileName: 'unknown',
          fileCount: 0,
          files: [],
          size: 0,
        });
      }

      const project = projectsMap.get(projectId)!;
      project.size += blob.size;
      if (!project.files.includes(filePath)) {
        project.files.push(filePath);
        project.fileCount = project.files.length;
      }
    }

    // Fetch metadata for each project to get actual upload date
    for (const [projectId, project] of projectsMap) {
      try {
        const metadataBlob = blobs.find(
          (b) => b.pathname === `projects/${projectId}/metadata.json`
        );

        if (metadataBlob) {
          const response = await fetch(metadataBlob.url, { cache: 'no-store' });
          const metadata = await response.json();
          project.uploadDate = metadata.uploadDate;
          project.fileName = metadata.fileName;
          // Use file count from metadata for accuracy
          project.fileCount = metadata.fileCount;
          project.files = metadata.files || project.files;
          if (metadata.owner) {
            project.owner = metadata.owner;
            if (blockedUsers.has(metadata.owner)) {
              project.isBlocked = true;
            }
          }
        }
      } catch (error) {
        console.error(`[v0] Error fetching metadata for ${projectId}:`, error);
      }
    }

    // Sort by upload date (newest first)
    const projects = Array.from(projectsMap.values())
      .sort(
        (a, b) =>
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      );

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[v0] Admin API error:', error);
    // Return empty array instead of error to gracefully handle missing token
    return NextResponse.json({ projects: [] });
  }
}
