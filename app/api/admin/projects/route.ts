import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

interface ProjectMetadata {
  projectId: string;
  uploadDate: string;
  fileName: string;
  fileCount: number;
  files: string[];
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.MANAGE_PASSWORD) {
      console.error('[v0] MANAGE_PASSWORD is not configured');
      return NextResponse.json(
        { error: 'Manage password is not configured' },
        { status: 500 }
      );
    }

    const providedPassword =
      request.headers.get('x-manage-password') ??
      request.cookies.get('admin_session')?.value;
    if (!providedPassword || providedPassword !== process.env.MANAGE_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Blob token is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn('[v0] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json({ projects: [] });
    }

    const { blobs } = await list({ prefix: 'projects/' });

    const projectsMap = new Map<string, ProjectMetadata>();

    // Process all blobs to build project metadata
    for (const blob of blobs) {
      const match = blob.pathname.match(/^projects\/([a-f0-9]+)\/(.+)$/);
      if (!match) continue;

      const [, projectId, filePath] = match;

      // Skip metadata file for now (we'll fetch it separately)
      if (filePath === 'metadata.json') continue;

      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, {
          projectId,
          uploadDate: new Date().toISOString(),
          fileName: 'unknown',
          fileCount: 0,
          files: [],
        });
      }

      const project = projectsMap.get(projectId)!;
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
          const response = await fetch(metadataBlob.url);
          const metadata = await response.json();
          project.uploadDate = metadata.uploadDate;
          project.fileName = metadata.fileName;
          // Use file count from metadata for accuracy
          project.fileCount = metadata.fileCount;
          project.files = metadata.files || project.files;
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
