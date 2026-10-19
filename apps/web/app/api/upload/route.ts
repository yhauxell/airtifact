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
import { getStorageAdapter } from '@/lib/storage';

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
    const file = formData.get('file') as File | null;
    const rawMarkdown = formData.get('markdown') as string | null;
    const customTitle = (formData.get('title') as string | null)?.trim() || undefined;
    const customFileName = (formData.get('fileName') as string | null)?.trim() || undefined;

    const projectId = generateProjectId();
    const deleteToken = generateDeleteToken();
    const deleteTokenHash = hashDeleteToken(deleteToken);
    const uploadedFiles: string[] = [];
    let hasIndexHtml = false;
    let hasMarkdown = false;
    let recordedFileName = customFileName || 'document.md';

    if (rawMarkdown && typeof rawMarkdown === 'string') {
      const bufferObject = Buffer.from(rawMarkdown, 'utf-8');
      if (bufferObject.byteLength > maxSize) {
        return NextResponse.json(
          { error: `Content size must be less than ${maxSizeMB}MB` },
          { status: 400 }
        );
      }

      const targetName =
        customFileName && /\.(md|markdown)$/i.test(customFileName)
          ? normalizeZipPath(customFileName) || 'index.md'
          : 'index.md';

      await getStorageAdapter().put(`projects/${projectId}/${targetName}`, bufferObject);
      uploadedFiles.push(targetName);
      hasMarkdown = true;
      recordedFileName = targetName;
    } else if (file) {
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File size must be less than ${maxSizeMB}MB` },
          { status: 400 }
        );
      }

      const lowerFileName = file.name.toLowerCase();
      const isZip = lowerFileName.endsWith('.zip');
      const isMd = lowerFileName.endsWith('.md') || lowerFileName.endsWith('.markdown');

      if (!isZip && !isMd) {
        return NextResponse.json(
          { error: 'File must be a ZIP archive (.zip) or Markdown document (.md)' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      recordedFileName = file.name;

      if (isMd) {
        const sanitizedName = normalizeZipPath(file.name) || 'index.md';
        const blobPath = `projects/${projectId}/${sanitizedName}`;
        await getStorageAdapter().put(blobPath, buffer);
        uploadedFiles.push(sanitizedName);
        hasMarkdown = true;
      } else {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(buffer);

        for (const [filePath, zipEntry] of Object.entries(zip.files)) {
          const normalizedPath = normalizeZipPath(filePath);

          if (!normalizedPath || shouldSkipNormalizedZipPath(normalizedPath)) {
            continue;
          }

          if (zipEntry.dir) continue;

          const lowerNormalized = normalizedPath.toLowerCase();
          if (lowerNormalized.endsWith('index.html')) {
            hasIndexHtml = true;
          }
          if (lowerNormalized.endsWith('.md') || lowerNormalized.endsWith('.markdown')) {
            hasMarkdown = true;
          }

          const fileBuffer = await zipEntry.async('arraybuffer');
          const bufferObject = Buffer.from(fileBuffer);

          const blobPath = `projects/${projectId}/${normalizedPath}`;
          await getStorageAdapter().put(blobPath, bufferObject);

          uploadedFiles.push(normalizedPath);
        }
      }
    } else {
      return NextResponse.json(
        { error: 'No file or markdown content provided' },
        { status: 400 }
      );
    }

    if (!hasIndexHtml && !hasMarkdown) {
      return NextResponse.json(
        { error: 'Upload must contain an index.html file or at least one Markdown (.md) file' },
        { status: 400 }
      );
    }

    const projectType = hasIndexHtml ? 'html' : 'markdown';

    const metadata: any = {
      projectId,
      projectType,
      title: customTitle,
      uploadDate: new Date().toISOString(),
      fileName: recordedFileName,
      fileCount: uploadedFiles.length,
      files: uploadedFiles.sort(),
      deleteTokenHash,
    };

    if (username) {
      metadata.owner = username;
    }

    await getStorageAdapter().put(
      `projects/${projectId}/metadata.json`,
      JSON.stringify(metadata)
    );

    return NextResponse.json({
      projectId,
      projectType,
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
