import { NextResponse } from 'next/server';
import { DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES } from '@/lib/upload-config';

export async function GET() {
  const maxFileUploadSize = parseInt(
    process.env.MAX_FILE_UPLOAD_SIZE ?? String(DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES),
    10
  );
  return NextResponse.json({ maxFileUploadSize });
}
