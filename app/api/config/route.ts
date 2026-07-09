import { NextResponse } from 'next/server';

export async function GET() {
  const maxFileUploadSize = parseInt(
    process.env.MAX_FILE_UPLOAD_SIZE ?? String(5 * 1024 * 1024),
    10
  );
  return NextResponse.json({ maxFileUploadSize });
}
