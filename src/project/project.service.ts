import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { basename, join } from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import { safeDeleteFile } from '../common/utils/delete-file.util.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectSortBy, QueryProjectsDto } from './dto/query-projects.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Create a new project
  async create(userId: string, dto: CreateProjectDto, attachmentUrl: string | undefined) {
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

    if (user.role !== 'CLIENT') {
      throw new ForbiddenException(
        'Only clients can create projects',
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, isActive: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!category.isActive) {
      throw new NotFoundException('Category is not active');
    }

    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        budget: dto.budget,
        categoryId: dto.categoryId,
        clientId: userId,
        attachmentUrl,
      },
      include: {
        category: true,
      },
    });

    return project;
  }


async findAll(query: QueryProjectsDto) {
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    sortBy = ProjectSortBy.NEWEST,
  } = query;

  // Calculate how many records to skip
  const skip = (page - 1) * limit;

  // Build filtering conditions
  const where = {
    status: 'OPEN' as const,

    ...(search && {
      title: {
        contains: search,
        mode: 'insensitive' as const,
      },
    }),

    ...(categoryId && {
      categoryId,
    }),
  };

  // Determine sorting
  let orderBy;

  switch (sortBy) {
    case ProjectSortBy.BUDGET_ASC:
      orderBy = { budget: 'asc' as const };
      break;

    case ProjectSortBy.BUDGET_DESC:
      orderBy = { budget: 'desc' as const };
      break;

    default:
      orderBy = { createdAt: 'desc' as const };
  }

  // Fetch projects and total count
  const [projects, total] = await this.prisma.$transaction([
    this.prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    this.prisma.project.count({ where }),
  ]);

  // Return paginated response
  return {
    data: projects,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}


async findOne(
  id: string,
  user?: { id: string; role: string },
) {
  const project = await this.prisma.project.findUnique({
    where: { id },
    include: {
      category: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      acceptedOffer: {
        select: {
          freelancerId: true,
        },
      },
      deliveries: {
        select: {
          id: true,
          status: true,
          fileName: true,
          reviewMessage: true,
          submittedAt: true,
          approvedAt: true,
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundException('Project not found');
  }

  const isOwner = !!user && project.clientId === user.id;
  const isAdmin = !!user && user.role === 'ADMIN';
  const isAcceptedFreelancer =
    !!user && project.acceptedOffer?.freelancerId === user.id;

  if (
    project.status !== 'OPEN' &&
    !isOwner &&
    !isAcceptedFreelancer &&
    !isAdmin
  ) {
    throw new NotFoundException('Project not found');
  }

  const { acceptedOffer, deliveries, ...projectData } = project;

  if (isOwner) {
    const offersCount = await this.prisma.offer.count({
      where: { projectId: id },
    });

    return {
      ...projectData,
      offersCount,
      deliveries,
    };
  }

  if (user && user.role === 'FREELANCER' && project.clientId !== user.id) {
    const myOffer = await this.prisma.offer.findFirst({
      where: {
        projectId: id,
        freelancerId: user.id,
      },
      select: {
        id: true,
        price: true,
        durationDays: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      ...projectData,
      myOffer: myOffer ?? null,
    };
  }

  return projectData;
 }


async update(
  projectId: string,
  userId: string,
  dto: UpdateProjectDto,
) {
  const existingProject = await this.prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      clientId: true,
      status: true,
    },
  });

  if (!existingProject) {
    throw new NotFoundException('Project not found');
  }

  if (existingProject.clientId !== userId) {
    throw new ForbiddenException(
      'You can only update your own projects',
    );
  }

  if (existingProject.status !== 'OPEN') {
    throw new ConflictException('Only open projects can be updated');
  }

  const updatedProject = await this.prisma.project.updateMany({
    where: {
      id: projectId,
      clientId: userId,
      status: 'OPEN',
    },
    data: {
      ...(dto.title !== undefined && {
        title: dto.title,
      }),

      ...(dto.description !== undefined && {
        description: dto.description,
      }),

      ...(dto.budget !== undefined && {
        budget: dto.budget,
      }),
    },
  });

  if (updatedProject.count !== 1) {
    throw new ConflictException('Only open projects can be updated');
  }

  return this.prisma.project.findUnique({
    where: { id: projectId },
    include: { category: true },
  });
}

async delete(projectId: string, userId: string) {
  const existingProject = await this.prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      clientId: true,
      status: true,
      attachmentUrl: true,
    },
  });

  if (!existingProject) {
    throw new NotFoundException('Project not found');
  }

  if (existingProject.clientId !== userId) {
    throw new ForbiddenException(
      'You can only delete your own projects',
    );
  }

  if (existingProject.status !== 'OPEN') {
    throw new ConflictException('Only open projects can be deleted');
  }

  const deleted = await this.prisma.project.deleteMany({
    where: {
      id: projectId,
      clientId: userId,
      status: 'OPEN',
    },
  });

  if (deleted.count !== 1) {
    throw new ConflictException('Only open projects can be deleted');
  }

  if (existingProject.attachmentUrl) {
    const fileName = basename(existingProject.attachmentUrl);
    await safeDeleteFile(
      join(process.cwd(), 'uploads', 'projects', fileName),
    );
  }

  return {
    message: 'Project deleted successfully',
  };
}
}

