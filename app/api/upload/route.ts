import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { randomBytes } from 'crypto';

// Generate a cryptographically secure random project ID
function generateProjectId(): string {
  return randomBytes(16).toString('hex');
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

    // Convert File to Buffer and extract ZIP
    const buffer = Buffer.from(await file.arrayBuffer());
    const projectId = generateProjectId();
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(buffer);

    const uploadedFiles: string[] = [];
    let hasIndexHtml = false;

    // Extract and upload files
    for (const [filePath, file] of Object.entries(zip.files)) {
      // Skip directories
      if (file.dir) continue;

      // Track index.html
      if (filePath.toLowerCase().endsWith('index.html')) {
        hasIndexHtml = true;
      }

      // Get file buffer
      const fileBuffer = await file.async('arraybuffer');
      const buffer_obj = Buffer.from(fileBuffer);

      // Upload to Vercel Blob
      const blobPath = `projects/${projectId}/${filePath}`;
      await put(blobPath, buffer_obj, {
        access: 'private',
      });

      uploadedFiles.push(filePath);
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
      { access: 'private' }
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
