import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { CategoriesController } from './categories.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CacheModule } from '@nestjs/cache-manager';
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  imports: [PrismaModule ,   CacheModule.register({
      ttl: 300000,
    }),
  ],
})
export class CategoriesModule {}
