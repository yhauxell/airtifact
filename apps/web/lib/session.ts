import { createHmac, scryptSync, timingSafeEqual } from 'crypto';

export interface SessionPayload {
  exp: number;
}

/**
 * Validates a plaintext password against the stored ADMIN_PASSWORD_HASH using scrypt.
 */
export function verifyPassword(password: string): boolean {
  const hashString = process.env.ADMIN_PASSWORD_HASH;
  if (!hashString || typeof hashString !== 'string') return false;

  const parts = hashString.split(':');
  if (parts.length !== 2) return false;

  const [salt, storedHash] = parts;
  try {
    const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (derivedKey.length !== storedBuffer.length) return false;
    return timingSafeEqual(derivedKey, storedBuffer);
  } catch (error) {
    return false;
  }
}

/**
 * Derives the HMAC signing key using SESSION_SECRET + ADMIN_PASSWORD_HASH.
 */
function getSigningKey(): string | null {
  const secret = process.env.SESSION_SECRET;
  const hashString = process.env.ADMIN_PASSWORD_HASH;
  if (!secret || !hashString) return null;
  return `${secret}:${hashString}`;
}

/**
 * Creates a signed session token containing an expiration payload.
 * The token format is: payloadBase64.signatureHex
 */
export function createSessionToken(expiresInSeconds: number = 7 * 24 * 60 * 60): string | null {
  const signingKey = getSigningKey();
  if (!signingKey) return null;

  const payload: SessionPayload = {
    exp: Date.now() + expiresInSeconds * 1000,
  };
  
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signingKey).update(payloadBase64).digest('hex');
  
  return `${payloadBase64}.${signature}`;
}

/**
 * Validates an admin request by checking either:
 *  - the x-manage-password header (raw password, for direct API callers), or
 *  - the admin_session cookie (HMAC-derived structured token).
 *
 * Returns true only when credentials match and the session has not expired.
 */
export function isValidAdminCredential(
  headerPassword: string | null,
  cookieValue: string | undefined
): boolean {
  // If direct password provided
  if (headerPassword !== null) {
    return verifyPassword(headerPassword);
  }

  // If session cookie provided
  if (cookieValue) {
    const signingKey = getSigningKey();
    if (!signingKey) return false;

    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [payloadBase64, signature] = parts;

    // Verify signature safely
    try {
      const expectedSignature = createHmac('sha256', signingKey).update(payloadBase64).digest('hex');
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) return false;
      if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

      // Verify expiration
      const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      const payload: SessionPayload = JSON.parse(payloadString);
      
      if (!payload.exp || Date.now() > payload.exp) {
        return false;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  return false;
}

// --- USER AUTHENTICATION UTILS ---

export interface UserSessionPayload {
  username: string;
  exp: number;
}

/**
 * Creates a stateless auth token for a standard user.
 */
export function createUserSessionToken(username: string, expiresInSeconds: number = 7 * 24 * 60 * 60): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const payload: UserSessionPayload = {
    username,
    exp: Date.now() + expiresInSeconds * 1000,
  };
  
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadBase64).digest('hex');
  
  return `${payloadBase64}.${signature}`;
}

/**
 * Validates a user session token from a cookie and returns the username if valid.
 */
export function validateUserSession(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;

  try {
    const expectedSignature = createHmac('sha256', secret).update(payloadBase64).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: UserSessionPayload = JSON.parse(payloadString);
    
    if (!payload.exp || Date.now() > payload.exp || !payload.username) {
      return null;
    }
    
    return payload.username;
  } catch (e) {
    return null;
  }
}

/**
 * Validates a generated API Key for a user (used for programmatic upload).
 * Format: sk_username.version.signature
 */
export function validateApiKeySignature(apiKey: string | undefined): { username: string, version: number } | null {
  if (!apiKey || !apiKey.startsWith('sk_')) return null;
  
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const content = apiKey.substring(3);
  const parts = content.split('.');
  if (parts.length !== 3) return null;

  const [username, versionStr, signature] = parts;
  const version = parseInt(versionStr, 10);
  if (isNaN(version)) return null;

  try {
    const expectedSignature = createHmac('sha256', secret).update(`${username}.${version}`).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    return { username, version };
  } catch (e) {
    return null;
  }
}

/**
 * Generates an API Key for a user
 */
export function generateUserApiKey(username: string, version: number): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  
  const signature = createHmac('sha256', secret).update(`${username}.${version}`).digest('hex');
  return `sk_${username}.${version}.${signature}`;
}
