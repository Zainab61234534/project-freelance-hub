import { unlink } from 'fs/promises';

export async function safeDeleteFile(filePath?: string | null): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== 'ENOENT') {
      throw error;
    }
  }
}
