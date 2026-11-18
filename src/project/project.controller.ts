
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { QueryProjectsDto } from './dto/query-projects.dto.js';
import { projectMulterOptions } from './multer.config.js';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { RolesGuard } from '../common/guards/Roles.guard.js';
import { ProjectsService } from './project.service.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { Roles } from '../common/decorator/Roles.decorator.js';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('projects')
@UseGuards(SessionAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  // Create project
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CLIENT')
  @UseInterceptors(
    FileInterceptor('attachment', projectMulterOptions),
  )
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProjectDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const attachmentUrl = file
      ? `/uploads/projects/${file.filename}`
      : undefined;

    try {
      return await this.projectsService.create(
        user.id,
        dto,
        attachmentUrl,
      );
    } catch (error) {
      if (file?.path) {
        const { safeDeleteFile } = await import(
          '../common/utils/delete-file.util.js'
        );
        await safeDeleteFile(file.path);
      }

      throw error;
    }
  }

  // Get all projects
  @Get()
  findAll(@Query() query: QueryProjectsDto) {
    return this.projectsService.findAll(query);
  }

  // Get one project
  @Get(':id')
  findOne(
    @CurrentUser() user: { id: string; role: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.findOne(id, user);
  }

  // Update project
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(
      id,
      user.id,
      dto,
    );
  }

  // Delete project
  @Delete(':id')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.projectsService.delete(
      id,
      user.id,
    );
  }
}
