import { promises as fs } from 'fs';
import { resolve, normalize, relative } from 'path';

/**
 * Validates that a file path is within a base directory
 * Prevents path traversal attacks by using realpath
 */
export async function validatePathWithinBase(basePath: string, targetPath: string): Promise<string> {
  const normalizedBase = await fs.realpath(basePath);
  const resolvedTarget = resolve(basePath, targetPath);

  // Get real path to handle symlinks
  let realTarget: string;
  try {
    realTarget = await fs.realpath(resolvedTarget);
  } catch {
    // File doesn't exist yet, validate parent directory
    const parent = resolve(resolvedTarget, '..');
    const realParent = await fs.realpath(parent);

    if (!realParent.startsWith(normalizedBase)) {
      throw new Error(`Path traversal attempt detected: ${targetPath}`);
    }

    return resolvedTarget;
  }

  if (!realTarget.startsWith(normalizedBase)) {
    throw new Error(`Path traversal attempt detected: ${targetPath}`);
  }

  return realTarget;
}

/**
 * Synchronous version for cases where async is not possible
 */
export function validatePathWithinBaseSync(basePath: string, targetPath: string): string {
  const normalizedBase = normalize(resolve(basePath));
  const resolvedTarget = normalize(resolve(basePath, targetPath));

  const relativePath = relative(normalizedBase, resolvedTarget);

  if (relativePath.startsWith('..') || resolve(relativePath) === relativePath) {
    throw new Error(`Path traversal attempt detected: ${targetPath}`);
  }

  return resolvedTarget;
}

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Escapes JavaScript string content to prevent injection
 */
export function escapeJs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\0/g, '\\0');
}

/**
 * Validates that origins are properly formatted
 */
export function validateOrigins(originsString: string): string[] {
  if (!originsString || originsString.trim() === '') {
    return [];
  }

  // Split by comma or semicolon, trim whitespace
  const origins = originsString
    .split(/[,;]/)
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // Validate each origin
  return origins.filter(origin => {
    try {
      const url = new URL(origin);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      console.warn(`Invalid origin format, skipping: ${origin}`);
      return false;
    }
  });
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T = unknown>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Validates file size limits
 */
export function validateFileSize(content: string, maxSizeBytes: number): void {
  const sizeBytes = Buffer.byteLength(content, 'utf8');

  if (sizeBytes > maxSizeBytes) {
    throw new Error(`File size ${sizeBytes} bytes exceeds maximum of ${maxSizeBytes} bytes`);
  }
}

/**
 * Validates total files size
 */
export function validateTotalFilesSize(
  files: Record<string, string>,
  maxTotalBytes: number
): void {
  let totalSize = 0;

  for (const content of Object.values(files)) {
    totalSize += Buffer.byteLength(content, 'utf8');

    if (totalSize > maxTotalBytes) {
      throw new Error(`Total files size exceeds maximum of ${maxTotalBytes} bytes`);
    }
  }
}

/**
 * Validates file count limits
 */
export function validateFileCount(
  files: Record<string, string>,
  maxFiles: number
): void {
  const count = Object.keys(files).length;

  if (count > maxFiles) {
    throw new Error(`File count ${count} exceeds maximum of ${maxFiles}`);
  }
}
