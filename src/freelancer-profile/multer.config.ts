import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

const uploadPath = join(
  process.cwd(),
  'uploads',
  'freelancer-profiles',
);

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const profileImageOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(uploadPath, { recursive: true });
      callback(null, uploadPath);
    },

    filename: (_req, file, callback) => {
      const extension = extensions[file.mimetype] ?? '.bin';
      callback(null, `${randomUUID()}${extension}`);
    },
  }),

  limits: {
    fileSize: 2 * 1024 * 1024,
  },

  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          'Only JPG, PNG and WebP images are allowed',
        ),
        false,
      );
    }

    callback(null, true);
  },
};