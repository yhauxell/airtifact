import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { 
  DEFAULT_MAX_ANON_UPLOAD_SIZE_BYTES, 
  DEFAULT_MAX_AUTH_UPLOAD_SIZE_BYTES 
} from '@/lib/upload-config';
import {
  generateDeleteToken,
  generateProjectId,
  getProjectRemovalUrl,
  hashDeleteToken,
} from '@/lib/project-removal';
import { validateUserSession, validateApiKeySignature } from '@/lib/session';
import { getUser } from '@/lib/user-store';

const MAX_ANON_UPLOAD_SIZE_BYTES = parseInt(
  process.env.MAX_ANON_UPLOAD_SIZE_BYTES ?? String(DEFAULT_MAX_ANON_UPLOAD_SIZE_BYTES),
  10
);

const MAX_AUTH_UPLOAD_SIZE_BYTES = parseInt(
  process.env.MAX_AUTH_UPLOAD_SIZE_BYTES ?? String(DEFAULT_MAX_AUTH_UPLOAD_SIZE_BYTES),
  10
);

const BLOCKED_DIRECTORY_NAMES = new Set(['__macosx', '__macos']);

function normalizeZipPath(filePath: string): string | null {
  const normalizedPath = filePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+?/g, '/');

  if (!normalizedPath) {
    return null;
  }

  const segments = normalizedPath.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return normalizedPath;
}

function shouldSkipNormalizedZipPath(normalizedPath: string): boolean {
  const segments = normalizedPath.split('/').filter(Boolean);

  return segments.some((segment) => {
    const lowerCaseSegment = segment.toLowerCase();
    return lowerCaseSegment.startsWith('.') || BLOCKED_DIRECTORY_NAMES.has(lowerCaseSegment);
  });
}

function getAuthContext(request: NextRequest): { username: string | null, error?: string } {
  // 1. Check API Key
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const keyInfo = validateApiKeySignature(token);
    if (keyInfo) {
      return { username: keyInfo.username };
    } else {
      return { username: null, error: 'Invalid API Key' };
    }
  }

  // 2. Check Session Cookie
  const sessionCookie = request.cookies.get('auth_session')?.value;
  const username = validateUserSession(sessionCookie);
  if (username) {
    return { username };
  }

  return { username: null };
}

export async function POST(request: NextRequest) {
  try {
    const authContext = getAuthContext(request);
    if (authContext.error) {
      return NextResponse.json({ error: authContext.error }, { status: 401 });
    }
    
    const { username } = authContext;
    const isWebClient = request.headers.get('X-Web-Client') === 'true';

    // Disallow programmatic API uploads if not authenticated
    if (!username && !isWebClient) {
      return NextResponse.json({ error: 'API Key required for programmatic uploads' }, { status: 401 });
    }

    if (username) {
      const profile = await getUser(username);
      if (profile?.isBlocked) {
        return NextResponse.json({ error: 'Your account has been blocked.' }, { status: 403 });
      }
    }

    const maxSize = username ? MAX_AUTH_UPLOAD_SIZE_BYTES : MAX_ANON_UPLOAD_SIZE_BYTES;
    const maxSizeMB = maxSize / (1024 * 1024);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json(
        { error: 'File must be a ZIP archive' },
        { status: 400 }
      );
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size must be less than ${maxSizeMB}MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const projectId = generateProjectId();
    const deleteToken = generateDeleteToken();
    const deleteTokenHash = hashDeleteToken(deleteToken);
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(buffer);

    const uploadedFiles: string[] = [];
    let hasIndexHtml = false;

    for (const [filePath, file] of Object.entries(zip.files)) {
      const normalizedPath = normalizeZipPath(filePath);

      if (!normalizedPath || shouldSkipNormalizedZipPath(normalizedPath)) {
        continue;
      }

      if (file.dir) continue;

      if (normalizedPath.toLowerCase().endsWith('index.html')) {
        hasIndexHtml = true;
      }

      const fileBuffer = await file.async('arraybuffer');
      const bufferObject = Buffer.from(fileBuffer);

      const blobPath = `projects/${projectId}/${normalizedPath}`;
      await put(blobPath, bufferObject, {
        access: 'public',
      });

      uploadedFiles.push(normalizedPath);
    }

    if (!hasIndexHtml) {
      return NextResponse.json(
        { error: 'ZIP must contain an index.html file' },
        { status: 400 }
      );
    }

    const metadata: any = {
      projectId,
      uploadDate: new Date().toISOString(),
      fileName: file.name,
      fileCount: uploadedFiles.length,
      files: uploadedFiles.sort(),
      deleteTokenHash,
    };

    if (username) {
      metadata.owner = username;
    }

    await put(
      `projects/${projectId}/metadata.json`,
      JSON.stringify(metadata),
      { access: 'public' }
    );

    return NextResponse.json({
      projectId,
      shareUrl: `/${projectId}`,
      removeUrl: getProjectRemovalUrl(projectId, deleteToken),
      deleteToken,
      files: uploadedFiles,
      metadata,
    });
  } catch (error) {
    console.error('[v0] Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
