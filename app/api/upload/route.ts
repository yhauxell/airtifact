import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { extract } from 'unzipper';
import { Readable } from 'stream';
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

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const projectId = generateProjectId();
    
    const uploadedFiles: string[] = [];
    let hasIndexHtml = false;

    // Extract and upload files
    await new Promise<void>((resolve, reject) => {
      Readable.from([buffer])
        .pipe(extract({ path: '' }))
        .on('entry', async (entry) => {
          try {
            const fileName = entry.path;
            
            // Skip directories
            if (entry.type === 'Directory') {
              entry.autodrain();
              return;
            }

            // Track index.html
            if (fileName.toLowerCase().endsWith('index.html')) {
              hasIndexHtml = true;
            }

            // Convert stream to buffer
            const chunks: Buffer[] = [];
            for await (const chunk of entry) {
              chunks.push(chunk as Buffer);
            }
            const fileBuffer = Buffer.concat(chunks);

            // Upload to Vercel Blob
            const blobPath = `projects/${projectId}/${fileName}`;
            await put(blobPath, fileBuffer, {
              access: 'private',
            });

            uploadedFiles.push(fileName);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .on('finish', resolve);
    });

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
