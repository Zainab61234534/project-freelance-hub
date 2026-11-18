import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FreelancerProfileService } from './freelancer-profile.service.js';
import { CreateFreelancerProfileDto } from './dto/create-freelancer-profile.dto.js';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto.js';
import { profileImageOptions } from './multer.config.js';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { RolesGuard } from '../common/guards/Roles.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { Roles } from '../common/decorator/Roles.decorator.js';

@Controller('freelancer-profile')
@UseGuards(SessionAuthGuard)
export class FreelancerProfileController {
  constructor(
    private readonly freelancerProfileService: FreelancerProfileService,
  ) {}

  // Create profile
  @Post()
  @UseGuards(RolesGuard)
  @Roles('FREELANCER')
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageOptions as any),
  )
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateFreelancerProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.freelancerProfileService.create(
      user.id,
      dto,
      file,
    );
  }

  // Get my profile
  @Get('me')
  findMyProfile(
    @CurrentUser() user: { id: string },
  ) {
    return this.freelancerProfileService.findMyProfile(
      user.id,
    );
  }

  // Update my profile
  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles('FREELANCER')
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageOptions as any),
  )
  update(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateFreelancerProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.freelancerProfileService.update(
      user.id,
      dto,
      file,
    );
  }
}