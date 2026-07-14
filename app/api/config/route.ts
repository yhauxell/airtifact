import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_MAX_ANON_UPLOAD_SIZE_BYTES,
  DEFAULT_MAX_AUTH_UPLOAD_SIZE_BYTES
} from '@/lib/upload-config';
import { validateUserSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('auth_session')?.value;
  const username = validateUserSession(sessionCookie);

  let maxFileUploadSize: number;

  if (username) {
    maxFileUploadSize = parseInt(
      process.env.MAX_AUTH_UPLOAD_SIZE_BYTES ?? String(DEFAULT_MAX_AUTH_UPLOAD_SIZE_BYTES),
      10
    );
  } else {
    maxFileUploadSize = parseInt(
      process.env.MAX_ANON_UPLOAD_SIZE_BYTES ?? String(DEFAULT_MAX_ANON_UPLOAD_SIZE_BYTES),
      10
    );
  }

  return NextResponse.json({ maxFileUploadSize });
}
