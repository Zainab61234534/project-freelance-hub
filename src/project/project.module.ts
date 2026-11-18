import { Module } from '@nestjs/common';

import { ProjectsController } from './project.controller.js';
import { ProjectsService } from './project.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
    imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectModule {}
