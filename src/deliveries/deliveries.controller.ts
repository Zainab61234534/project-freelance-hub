
import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  Get,
  Res,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { unlink } from 'fs/promises';
import { mkdirSync } from 'fs';
import { extname, join, basename } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

import { DeliveriesService } from './deliveries.service.js';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { RolesGuard } from '../common/guards/Roles.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { Roles } from '../common/decorator/Roles.decorator.js';
import { ReviewDeliveryDto } from './dto/review-delivery.dto.js';
import { hasAllowedFileType } from '../common/utils/file-validation.util.js';
import { ALLOWED_FILE_TYPES } from '../common/utils/allowed-file-types.js';

// إنشاء مجلد حفظ الملفات
const uploadPath = join(process.cwd(), 'uploads', 'deliveries');

mkdirSync(uploadPath, { recursive: true });

@Controller('deliveries')
@UseGuards(SessionAuthGuard)
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService,
  ) {}

  // رفع التسليم
  @Post('projects/:projectId')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('FREELANCER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadPath,
        filename: (req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase();
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        const allowedMimeTypes = ALLOWED_FILE_TYPES[extension];

        if (
          !allowedMimeTypes ||
          !allowedMimeTypes.includes(file.mimetype)
        ) {
          return callback(
            new BadRequestException(
              'Only PDF and compressed files are allowed',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async create(
    @CurrentUser() user: { id: string; role: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Delivery file is required');
    }

    const decodedFileName = Buffer.from(
      file.originalname,
      'latin1',
    ).toString('utf8');

    try {
      const extension = extname(file.originalname).toLowerCase();
      const allowedMimeTypes = ALLOWED_FILE_TYPES[extension] ?? [];

      const isValidFile = await hasAllowedFileType(
        file.path,
        allowedMimeTypes,
      );

      if (!isValidFile) {
        throw new BadRequestException(
          'Invalid file content. Only PDF and compressed files are allowed.',
        );
      }

      return await this.deliveriesService.create(
        user.id,
        user.role,
        projectId,
        `/uploads/deliveries/${file.filename}`,
        decodedFileName,
      );
    } catch (error) {
      try {
        await unlink(file.path);
      } catch {
        // ignore cleanup errors
      }

      throw error;
    }
  }

  @Get('projects/:projectId')
  async findProjectDeliveries(
    @CurrentUser() user: { id: string; role: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.deliveriesService.findProjectDeliveries(
      user.id,
      user.role,
      projectId,
    );
  }

  @Get(':deliveryId/download')
  async downloadDelivery(
    @CurrentUser() user: { id: string; role: string },
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Res() res: Response,
  ) {
    const download = await this.deliveriesService.downloadDelivery(
      user.id,
      user.role,
      deliveryId,
    );

    const fileName = download.fileName ?? basename(download.filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(download.filePath, fileName);
  }

  // مراجعة التسليم
  @Patch(':deliveryId/review')
  review(
    @CurrentUser() user: { id: string; role: string },
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Body() dto: ReviewDeliveryDto,
  ) {
    return this.deliveriesService.review(
      user.id,
      user.role,
      deliveryId,
      dto,
    );
  }
}
