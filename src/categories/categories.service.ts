import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER)
     private cacheManager: Cache,
  ) {}

  async create(userId: string, dto: CreateCategoryDto) {
    // 1. التأكد من وجود المستخدم
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. التأكد أن المستخدم Admin
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only admins can create categories',
      );
    }

    // 3. التأكد أن اسم التصنيف غير مستخدم
    const existingCategory = await this.prisma.category.findUnique({
      where: {
        name: dto.name,
      },
    });

    if (existingCategory) {
      throw new ConflictException(
        'Category name already exists',
      );
    }

    // 4. إنشاء التصنيف
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

// 5. حذف الكاش القديم
await this.cacheManager.del('categories:all');

return category;
  }

async findAll() {
  const cacheKey = 'categories:all';

  // 1. محاولة جلب التصنيفات من الكاش
  const cachedCategories =
    await this.cacheManager.get(cacheKey);

  // 2. إذا كانت موجودة، نعيدها مباشرة
  if (cachedCategories) {
    return cachedCategories;
  }

  // 3. إذا لم تكن موجودة، نجلبها من قاعدة البيانات
  const categories = await this.prisma.category.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  // 4. تخزين النتيجة في الكاش
  await this.cacheManager.set(cacheKey, categories);

  return categories;
}

async findOne(id: string) {
  const category = await this.prisma.category.findUnique({
    where: {
      id,
    },
  });

  if (!category) {
    throw new NotFoundException('Category not found');
  }

  return category;
}

async update(
  userId: string,
  id: string,
  dto: UpdateCategoryDto,
) {
  // 1. التأكد من وجود المستخدم
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // 2. المدير فقط يستطيع التعديل
  if (user.role !== 'ADMIN') {
    throw new ForbiddenException(
      'Only admins can update categories',
    );
  }

  // 3. التأكد من وجود التصنيف
  const category = await this.prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new NotFoundException('Category not found');
  }

  // 4. التأكد من أن هناك بيانات للتعديل
  if (Object.keys(dto).length === 0) {
    throw new BadRequestException(
      'At least one field must be provided',
    );
  }

  // 5. التأكد من عدم تكرار الاسم
  if (dto.name && dto.name !== category.name) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });

    if (existingCategory) {
      throw new ConflictException(
        'Category name already exists',
      );
    }
  }

  // 6. تنفيذ التعديل
  const updatedCategory = await this.prisma.category.update({
    where: { id },
    data: dto,
  });

  await this.cacheManager.del('categories:all');

  return updatedCategory;
}
}
