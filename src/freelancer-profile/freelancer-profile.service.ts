import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { safeDeleteFile } from '../common/utils/delete-file.util.js';
import { CreateFreelancerProfileDto } from './dto/create-freelancer-profile.dto.js';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto.js';
import { join } from 'path';

@Injectable()
export class FreelancerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateFreelancerProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'FREELANCER') {
      throw new ForbiddenException(
        'Only freelancers can create a profile',
      );
    }

    const existingProfile =
      await this.prisma.freelancerProfile.findUnique({
        where: { userId },
      });

    if (existingProfile) {
      throw new ConflictException(
        'Profile already exists',
      );
    }

    try {
      return await this.prisma.freelancerProfile.create({
        data: {
          userId,
          bio: dto.bio,
          hourlyRate: dto.hourlyRate,
          profileImage: file
            ? `/uploads/freelancer-profiles/${file.filename}`
            : null,
        },
      });
    } catch (error) {
      if (file?.path) {
        await safeDeleteFile(file.path);
      }

      throw error;
    }
  }

  async findMyProfile(userId: string) {
    const profile =
      await this.prisma.freelancerProfile.findUnique({
        where: { userId },
      });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async update(
    userId: string,
    dto: UpdateFreelancerProfileDto,
    file?: Express.Multer.File,
  ) {
    const profile =
      await this.prisma.freelancerProfile.findUnique({
        where: { userId },
      });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const currentProfileImage = profile.profileImage;

    try {
      const updatedProfile = await this.prisma.freelancerProfile.update({
        where: { userId },
        data: {
          bio: dto.bio,
          hourlyRate: dto.hourlyRate,
          ...(file && {
            profileImage: `/uploads/freelancer-profiles/${file.filename}`,
          }),
        },
      });

      if (file && currentProfileImage) {
        await safeDeleteFile(
          join(process.cwd(), currentProfileImage.replace(/^\/+/, '')),
        );
      }

      return updatedProfile;
    } catch (error) {
      if (file?.path) {
        await safeDeleteFile(file.path);
      }

      throw error;
    }
  }
}