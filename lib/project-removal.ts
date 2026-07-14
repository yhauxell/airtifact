import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const PROJECT_ID_PATTERN = /^[a-f0-9]{32}$/;
export const DELETE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export interface StoredProjectMetadata {
  projectId: string;
  uploadDate: string;
  fileName: string;
  fileCount: number;
  files: string[];
  deleteTokenHash: string;
}

export function generateProjectId(): string {
  return randomBytes(16).toString('hex');
}

export function generateDeleteToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashDeleteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isValidProjectId(projectId: string): boolean {
  return PROJECT_ID_PATTERN.test(projectId);
}

export function isValidDeleteToken(token: string): boolean {
  return DELETE_TOKEN_PATTERN.test(token);
}

export function isDeleteTokenMatch(token: string, expectedHash: string): boolean {
  if (!isValidDeleteToken(token) || !DELETE_TOKEN_PATTERN.test(expectedHash)) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(hashDeleteToken(token), 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}

export function getProjectRemovalPath(projectId: string): string {
  return `/project/${projectId}/r`;
}

export function getProjectRemovalUrl(projectId: string, deleteToken: string): string {
  return `${getProjectRemovalPath(projectId)}?t=${deleteToken}`;
}
