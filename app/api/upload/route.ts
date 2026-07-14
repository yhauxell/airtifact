import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES } from '@/lib/upload-config';
import {
  generateDeleteToken,
  generateProjectId,
  getProjectRemovalUrl,
  hashDeleteToken,
} from '@/lib/project-removal';

const MAX_UPLOAD_SIZE_BYTES = parseInt(
  process.env.MAX_FILE_UPLOAD_SIZE ?? String(DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES),
  10
);
const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE_BYTES / (1024 * 1024);
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

export async function POST(request: NextRequest) {
  try {
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

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_UPLOAD_SIZE_MB}MB` },
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

    const metadata = {
      projectId,
      uploadDate: new Date().toISOString(),
      fileName: file.name,
      fileCount: uploadedFiles.length,
      files: uploadedFiles.sort(),
      deleteTokenHash,
    };

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
