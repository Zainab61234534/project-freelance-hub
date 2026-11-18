
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReviewDeliveryDto } from './dto/review-delivery.dto.js';

@Injectable()
export class DeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCanAccessProject(
    userId: string,
    role: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        acceptedOffer: {
          select: {
            freelancerId: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId === userId) {
      return project;
    }

    if (
      role === 'FREELANCER' &&
      project.acceptedOffer?.freelancerId === userId
    ) {
      return project;
    }

    throw new ForbiddenException(
      'You do not have access to this project',
    );
  }

  async findProjectDeliveries(
    userId: string,
    role: string,
    projectId: string,
  ) {
    await this.assertCanAccessProject(userId, role, projectId);

    return this.prisma.delivery.findMany({
      where: { projectId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        status: true,
        fileName: true,
        reviewMessage: true,
        submittedAt: true,
        approvedAt: true,
      },
    });
  }

  async downloadDelivery(
    userId: string,
    role: string,
    deliveryId: string,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        project: {
          select: {
            id: true,
            clientId: true,
            acceptedOffer: {
              select: {
                freelancerId: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    if (
      delivery.project.clientId !== userId &&
      !(role === 'FREELANCER' && delivery.project.acceptedOffer?.freelancerId === userId)
    ) {
      throw new ForbiddenException(
        'You do not have access to this delivery',
      );
    }

    const filePath = join(
      process.cwd(),
      'uploads',
      'deliveries',
      basename(delivery.fileUrl),
    );

    if (!existsSync(filePath)) {
      throw new NotFoundException('Delivery file not found');
    }

    return {
      filePath,
      fileName: delivery.fileName,
    };
  }

  async create(
  freelancerId: string,
  role: string,
  projectId: string,
  fileUrl: string,
  fileName: string,
) {
  // 1. التأكد أن المستخدم مستقل
  if (role !== 'FREELANCER') {
    throw new ForbiddenException(
      'Only freelancers can submit deliveries',
    );
  }

  // 2. إعادة المحاولة عند حدوث تعارض متزامن
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 3. البحث عن المشروع والعرض المقبول
          const project = await tx.project.findUnique({
            where: { id: projectId },
            include: {
              acceptedOffer: true,
            },
          });

          if (!project) {
            throw new NotFoundException('Project not found');
          }

          // 4. التأكد أن المشروع قيد التنفيذ
          if (project.status !== 'IN_PROGRESS') {
            throw new BadRequestException(
              'Project is not in progress',
            );
          }

          // 5. التأكد أن هناك عرضاً مقبولاً
          if (!project.acceptedOffer) {
            throw new BadRequestException(
              'Project has no accepted offer',
            );
          }

          // 6. التأكد أن المستقل هو صاحب العرض المقبول
          if (
            project.acceptedOffer.freelancerId !== freelancerId
          ) {
            throw new ForbiddenException(
              'You are not assigned to this project',
            );
          }

          // 7. البحث عن تسليم معلق
          const pendingDelivery = await tx.delivery.findFirst({
            where: {
              projectId,
              status: 'PENDING',
            },
          });

          if (pendingDelivery) {
            throw new ConflictException(
              'There is already a pending delivery',
            );
          }

          // 8. إنشاء التسليم
          const delivery = await tx.delivery.create({
            data: {
              projectId,
              fileUrl,
              fileName,
            },
          });

          return {
            message: 'Delivery submitted successfully',
            delivery,
          };
        },
        {
          isolationLevel: 'Serializable',
        },
      );
    } catch (error) {
      // 9. إعادة المحاولة عند تعارض المعاملات
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        if (attempt < 3) {
          continue;
        }

        throw new ConflictException(
          'Could not submit delivery due to concurrent requests. Please try again.',
        );
      }

      throw error;
    }
  }

  throw new ConflictException(
    'Could not submit delivery',
  );
}





async review(
  clientId: string,
  role: string,
  deliveryId: string,
  dto: ReviewDeliveryDto,
) {
  // 1. التأكد أن المستخدم عميل
  if (role !== 'CLIENT') {
    throw new ForbiddenException(
      'Only clients can review deliveries',
    );
  }

  // 2. البحث عن التسليم والمشروع والعرض المقبول
  const delivery = await this.prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      status: true,
      reviewMessage: true,
      projectId: true,
      fileUrl: true,
      fileName: true,
      submittedAt: true,
      approvedAt: true,
      project: {
        include: {
          acceptedOffer: true,
        },
      },
    },
  });

  if (!delivery) {
    throw new NotFoundException('Delivery not found');
  }

  const project = delivery.project;

  // 3. التأكد أن العميل هو صاحب المشروع
  if (project.clientId !== clientId) {
    throw new ForbiddenException(
      'You do not own this project',
    );
  }

  // 4. التأكد أن المشروع قيد التنفيذ
  if (project.status !== 'IN_PROGRESS') {
    throw new BadRequestException(
      'Project is not in progress',
    );
  }

  // 5. التأكد أن التسليم لم تتم مراجعته
  if (delivery.status !== 'PENDING') {
    throw new ConflictException(
      'This delivery has already been reviewed',
    );
  }

  // 6. إذا طلب العميل تعديلات
  if (dto.status === 'REVISION_REQUESTED') {
    const deliveryUpdate = await this.prisma.delivery.updateMany({
      where: {
        id: deliveryId,
        status: 'PENDING',
        project: {
          is: {
            clientId,
            status: 'IN_PROGRESS',
          },
        },
      },
      data: {
        status: 'REVISION_REQUESTED',
        reviewMessage: dto.reviewMessage,
      },
    });

    if (deliveryUpdate.count !== 1) {
      throw new ConflictException(
        'Delivery or project status has changed',
      );
    }

    const updatedDelivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    return {
      message: 'Revision requested successfully',
      delivery: updatedDelivery,
    };
  }

  // 7. الموافقة على التسليم وتحويل الأموال
  // إعادة المحاولة عند حدوث Transaction Conflict
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // إعادة جلب البيانات داخل Transaction
          const currentDelivery = await tx.delivery.findUnique({
            where: { id: deliveryId },
            select: {
              id: true,
              status: true,
              project: {
                include: {
                  acceptedOffer: true,
                },
              },
            },
          });

          if (!currentDelivery) {
            throw new NotFoundException('Delivery not found');
          }

          const currentProject = currentDelivery.project;

          // التأكد من ملكية المشروع داخل Transaction
          if (currentProject.clientId !== clientId) {
            throw new ForbiddenException(
              'You do not own this project',
            );
          }

          const acceptedOffer = currentProject.acceptedOffer;

          // التأكد من حالة التسليم والمشروع
          if (
            currentDelivery.status !== 'PENDING' ||
            currentProject.status !== 'IN_PROGRESS'
          ) {
            throw new ConflictException(
              'Delivery or project status has changed',
            );
          }

          // التأكد من وجود عرض مقبول
          if (!acceptedOffer) {
            throw new BadRequestException(
              'Project has no accepted offer',
            );
          }

          // 8. البحث عن المحافظ
          const clientWallet = await tx.wallet.findUnique({
            where: { userId: clientId },
          });

          const freelancerWallet = await tx.wallet.findUnique({
            where: { userId: acceptedOffer.freelancerId },
          });

          const platformWallet = await tx.wallet.findFirst({
            where: { isPlatform: true },
          });

          if (
            !clientWallet ||
            !freelancerWallet ||
            !platformWallet
          ) {
            throw new NotFoundException(
              'One or more wallets not found',
            );
          }

          // 9. حساب حصة المستقل والمنصة
          const totalAmount = acceptedOffer.price;

          const freelancerShare = totalAmount
            .mul(90)
            .div(100)
            .toDecimalPlaces(2);

          const platformFee = totalAmount.minus(freelancerShare);

          // 10. خصم المبلغ من رصيد العميل المحجوز
          const clientUpdate = await tx.wallet.updateMany({
            where: {
              id: clientWallet.id,
              reservedBalance: { gte: totalAmount },
            },
            data: {
              reservedBalance: { decrement: totalAmount },
            },
          });

          if (clientUpdate.count !== 1) {
            throw new ConflictException(
              'Insufficient reserved balance',
            );
          }

          // 11. إضافة 90% إلى المستقل
          await tx.wallet.update({
            where: { id: freelancerWallet.id },
            data: {
              availableBalance: {
                increment: freelancerShare,
              },
            },
          });

          // 12. إضافة 10% إلى المنصة
          await tx.wallet.update({
            where: { id: platformWallet.id },
            data: {
              availableBalance: {
                increment: platformFee,
              },
            },
          });

          // 13. تسجيل المعاملات المالية
          await tx.walletTransaction.createMany({
            data: [
              {
                walletId: clientWallet.id,
                amount: totalAmount,
                type: 'RESERVATION_CAPTURE',
                referenceId: currentProject.id,
                referenceType: 'PROJECT',
                description: 'Reserved amount captured',
              },
              {
                walletId: freelancerWallet.id,
                amount: freelancerShare,
                type: 'PAYMENT_RECEIVED',
                referenceId: currentProject.id,
                referenceType: 'PROJECT',
                description:
                  'Payment received for completed project',
              },
              {
                walletId: platformWallet.id,
                amount: platformFee,
                type: 'PLATFORM_FEE',
                referenceId: currentProject.id,
                referenceType: 'PROJECT',
                description: 'Platform commission',
              },
            ],
          });

          // 14. تحديث حالة التسليم
          const deliveryUpdate = await tx.delivery.updateMany({
            where: {
              id: deliveryId,
              status: 'PENDING',
            },
            data: {
              status: 'APPROVED',
              approvedAt: new Date(),
            },
          });

          if (deliveryUpdate.count !== 1) {
            throw new ConflictException(
              'Delivery has already been reviewed',
            );
          }

          // 15. تحديث حالة المشروع
          const projectUpdate = await tx.project.updateMany({
            where: {
              id: currentProject.id,
              status: 'IN_PROGRESS',
            },
            data: {
              status: 'COMPLETED',
            },
          });

          if (projectUpdate.count !== 1) {
            throw new ConflictException(
              'Project status has changed',
            );
          }

          return {
            message:
              'Delivery approved and payment completed successfully',
            totalAmount: totalAmount.toString(),
            freelancerShare: freelancerShare.toString(),
            platformFee: platformFee.toString(),
          };
        },
        {
          isolationLevel: 'Serializable',
        },
      );
    } catch (error) {
      // إعادة المحاولة فقط عند حدوث Transaction Conflict
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        if (attempt < 3) {
          continue;
        }

        throw new ConflictException(
          'Payment processing conflict. Please try again.',
        );
      }

      throw error;
    }
  }

  throw new ConflictException(
    'Could not complete payment',
  );
}




}
