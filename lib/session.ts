import { createHmac } from 'crypto';

const SESSION_CONTEXT = 'static-website-uploader-admin-session-v1';

/**
 * Derives a session token from the admin password using HMAC-SHA256.
 * This means the cookie never contains the raw password — if the cookie
 * leaks (e.g. in logs), the plaintext credential is not directly exposed.
 * The token changes automatically whenever the password changes, which
 * invalidates all existing sessions.
 */
export function createSessionToken(password: string): string {
  return createHmac('sha256', password).update(SESSION_CONTEXT).digest('hex');
}

/**
 * Validates an admin request by checking either:
 *  - the x-manage-password header (raw password, for direct API callers), or
 *  - the admin_session cookie (HMAC-derived token, set by the login endpoint).
 *
 * Returns true only when MANAGE_PASSWORD is configured and the credential matches.
 */
export function isValidAdminCredential(
  headerPassword: string | null,
  cookieValue: string | undefined
): boolean {
  const managePassword = process.env.MANAGE_PASSWORD;
  if (!managePassword) return false;

  if (headerPassword !== null) {
    return headerPassword === managePassword;
  }

  if (cookieValue) {
    return cookieValue === createSessionToken(managePassword);
  }

  return false;
}
