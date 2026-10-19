import { NextRequest, NextResponse } from 'next/server';
import { isValidProjectId } from '@/lib/project-removal';
import { getStorageAdapter } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ projectId: string; path: string[] }>;
  }
) {
  try {
    const { projectId, path } = await params;
    const filePath = path.join('/');

    if (!projectId || !filePath) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    if (!isValidProjectId(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    if (filePath === 'metadata.json') {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Fetch the file content
    const content = await getStorageAdapter().getContent(`projects/${projectId}/${filePath}`);
    if (!content) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Determine content type
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentTypeMap: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      md: 'text/markdown; charset=utf-8',
      markdown: 'text/markdown; charset=utf-8',
      txt: 'text/plain; charset=utf-8',
      css: 'text/css; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      json: 'application/json; charset=utf-8',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      otf: 'font/otf',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[v0] File serving error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
