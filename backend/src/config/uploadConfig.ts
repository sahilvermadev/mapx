/**
 * Configuration for file uploads
 */

export const UPLOAD_CONFIG = {
  BANNER: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ] as const,
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const,
    FIELD_NAME: 'banner',
  },
} as const;

export type AllowedMimeType = typeof UPLOAD_CONFIG.BANNER.ALLOWED_MIME_TYPES[number];
export type AllowedExtension = typeof UPLOAD_CONFIG.BANNER.ALLOWED_EXTENSIONS[number];

/**
 * Validate file extension matches MIME type
 */
export function validateFileExtension(
  filename: string,
  mimeType: string
): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/jpg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
  };

  return (
    UPLOAD_CONFIG.BANNER.ALLOWED_EXTENSIONS.includes(ext as AllowedExtension) &&
    mimeToExt[mimeType]?.includes(ext)
  );
}
