
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.zip': [
    'application/zip',
    'application/x-zip-compressed',
  ],
  '.rar': [
    'application/vnd.rar',
    'application/x-rar-compressed',
  ],
  '.7z': ['application/x-7z-compressed'],
};

export const ALLOWED_FILE_MIME_TYPES = [
  ...new Set(Object.values(ALLOWED_FILE_TYPES).flat()),
];
