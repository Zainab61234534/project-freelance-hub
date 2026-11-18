
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';

import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';


@Controller('categories')
@UseGuards(SessionAuthGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  // إنشاء تصنيف - ADMIN فقط
  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(user.id, dto);
  }

  // عرض جميع التصنيفات النشطة
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  // عرض تصنيف واحد
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  // تعديل تصنيف - ADMIN فقط
  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.id, id, dto);
  }
}
