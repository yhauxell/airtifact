import { put, head } from '@vercel/blob';
import { scryptSync, randomBytes } from 'crypto';

export interface UserProfile {
  username: string;
  passwordHash: string; // "salt:hash"
  apiKeyVersion: number;
  isBlocked?: boolean;
}

/**
 * Hash a plaintext password using scrypt
 */
export function hashUserPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function getUserBlobPath(username: string): string {
  // Simple sanitize to prevent injection in paths
  const safeName = username.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  return `users/${safeName}/profile.json`;
}

/**
 * Checks if a user profile exists
 */
export async function userExists(username: string): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    const blobPath = getUserBlobPath(username);
    await head(blobPath);
    return true;
  } catch (error: any) {
    // Vercel Blob returns 404 for missing blobs (BlobNotFoundError)
    return false;
  }
}

/**
 * Creates a new user profile in Blob storage
 */
export async function createUser(username: string, passwordHash: string): Promise<UserProfile> {
  const profile: UserProfile = {
    username,
    passwordHash,
    apiKeyVersion: 0,
  };
  
  await put(getUserBlobPath(username), JSON.stringify(profile), {
    access: 'public',
    addRandomSuffix: false, // Explicitly overwrite or access predictably
    allowOverwrite: true,
  });
  
  return profile;
}

/**
 * Fetches an existing user profile from Blob storage
 */
export async function getUser(username: string): Promise<UserProfile | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  
  try {
    const blobPath = getUserBlobPath(username);
    // head() gives us the URL to fetch
    const metadata = await head(blobPath);
    if (!metadata) return null;
    
    const response = await fetch(metadata.url, { cache: 'no-store' });
    if (!response.ok) return null;
    
    return await response.json() as UserProfile;
  } catch (error) {
    return null;
  }
}

/**
 * Updates a user profile
 */
export async function updateUser(profile: UserProfile): Promise<UserProfile> {
  await put(getUserBlobPath(profile.username), JSON.stringify(profile), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return profile;
}

/**
 * Deletes a user profile from Blob storage
 */
export async function deleteUser(username: string): Promise<void> {
  const { del } = await import('@vercel/blob');
  const blobPath = getUserBlobPath(username);
  await del(blobPath);
}
