import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { randomBytes } from 'crypto';

const MAX_UPLOAD_SIZE_MB = 5;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
const BLOCKED_DIRECTORY_NAMES = new Set(['__macosx', '__macos']);

// Generate a cryptographically secure random project ID
function generateProjectId(): string {
  return randomBytes(16).toString('hex');
}

function normalizeZipPath(filePath: string): string | null {
  const normalizedPath = filePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');

  if (!normalizedPath) {
    return null;
  }

  const segments = normalizedPath.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null;
  }

  return normalizedPath;
}

function shouldSkipZipPath(filePath: string): boolean {
  const segments = filePath.split('/');

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

    // Convert File to Buffer and extract ZIP
    const buffer = Buffer.from(await file.arrayBuffer());
    const projectId = generateProjectId();
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(buffer);

    const uploadedFiles: string[] = [];
    let hasIndexHtml = false;

    // Extract and upload files
    for (const [filePath, file] of Object.entries(zip.files)) {
      const normalizedPath = normalizeZipPath(filePath);

      if (!normalizedPath || shouldSkipZipPath(normalizedPath)) {
        continue;
      }

      // Skip directories
      if (file.dir) continue;

      // Track index.html
      if (normalizedPath.toLowerCase().endsWith('index.html')) {
        hasIndexHtml = true;
      }

      // Get file buffer
      const fileBuffer = await file.async('arraybuffer');
      const buffer_obj = Buffer.from(fileBuffer);

      // Upload to Vercel Blob
      const blobPath = `projects/${projectId}/${normalizedPath}`;
      await put(blobPath, buffer_obj, {
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

    // Store project metadata
    const metadata = {
      projectId,
      uploadDate: new Date().toISOString(),
      fileName: file.name,
      fileCount: uploadedFiles.length,
      files: uploadedFiles.sort(),
    };

    await put(
      `projects/${projectId}/metadata.json`,
      JSON.stringify(metadata),
      { access: 'public' }
    );

    return NextResponse.json({
      projectId,
      shareUrl: `/${projectId}`,
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
