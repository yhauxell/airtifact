import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminCredential } from '@/lib/session';

interface DashboardMetrics {
  totalUsers: number;
  totalProjectsAuth: number;
  totalProjectsAnon: number;
  topUsers: { username: string; projectCount: number }[];
  latestProjects: { projectId: string; url: string; uploadDate: string; fileName: string }[];
  totalUploadSize: number;
  biggestProject: { projectId: string; url: string; size: number; fileName: string } | null;
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

    // Fetch all users
    const usersList = await list({ prefix: 'users/' });
    const userProfiles = usersList.blobs.filter(b => b.pathname.endsWith('/profile.json'));
    const totalUsers = userProfiles.length;

    // Fetch all projects
    const projectsList = await list({ prefix: 'projects/' });
    
    const projectsMap = new Map<string, { size: number; hasMetadata: boolean }>();
    let totalUploadSize = 0;

    for (const blob of projectsList.blobs) {
      const match = blob.pathname.match(/^projects\/([a-f0-9]+)\/(.+)$/);
      if (!match) continue;

      const [, projectId, filePath] = match;
      
      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, { size: 0, hasMetadata: false });
      }

      projectsMap.get(projectId)!.size += blob.size;
      totalUploadSize += blob.size;
      
      if (filePath === 'metadata.json') {
        projectsMap.get(projectId)!.hasMetadata = true;
      }
    }

    let totalProjectsAuth = 0;
    let totalProjectsAnon = 0;
    const userProjectCounts: Record<string, number> = {};
    const projectsData: any[] = [];
    let biggestProject: any = null;

    for (const [projectId, projectInfo] of projectsMap) {
      let uploadDate = new Date().toISOString();
      let fileName = 'unknown';
      let owner: string | undefined;

      if (projectInfo.hasMetadata) {
        try {
          const metadataBlob = projectsList.blobs.find(b => b.pathname === `projects/${projectId}/metadata.json`);
          if (metadataBlob) {
            const response = await fetch(metadataBlob.url);
            const metadata = await response.json();
            uploadDate = metadata.uploadDate || uploadDate;
            fileName = metadata.fileName || fileName;
            owner = metadata.owner;
          }
        } catch (err) {
          console.error(`Error fetching metadata for ${projectId}`);
        }
      }

      if (owner) {
        totalProjectsAuth++;
        userProjectCounts[owner] = (userProjectCounts[owner] || 0) + 1;
      } else {
        totalProjectsAnon++;
      }

      const pData = {
        projectId,
        url: `/${projectId}`,
        size: projectInfo.size,
        uploadDate,
        fileName,
        owner
      };

      projectsData.push(pData);

      if (!biggestProject || projectInfo.size > biggestProject.size) {
        biggestProject = pData;
      }
    }

    const topUsers = Object.entries(userProjectCounts)
      .map(([username, projectCount]) => ({ username, projectCount }))
      .sort((a, b) => b.projectCount - a.projectCount)
      .slice(0, 5);

    const latestProjects = projectsData
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
      .slice(0, 5)
      .map(p => ({
        projectId: p.projectId,
        url: p.url,
        uploadDate: p.uploadDate,
        fileName: p.fileName
      }));

    const metrics: DashboardMetrics = {
      totalUsers,
      totalProjectsAuth,
      totalProjectsAnon,
      topUsers,
      latestProjects,
      totalUploadSize,
      biggestProject: biggestProject ? {
        projectId: biggestProject.projectId,
        url: biggestProject.url,
        size: biggestProject.size,
        fileName: biggestProject.fileName
      } : null
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[v0] Admin dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
