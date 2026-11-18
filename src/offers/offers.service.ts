
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import { UpdateOfferDto } from './dto/update-offer.dto.js';


@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // 1. Create an offer
  async create(
    freelancerId: string,
    role: string,
    projectId: string,
    dto: CreateOfferDto,
  ) {
    if (role !== 'FREELANCER') {
      throw new ForbiddenException(
        'Only freelancers can create offers',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        status: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status !== 'OPEN') {
      throw new BadRequestException(
        'This project is not open for offers',
      );
    }

    if (project.clientId === freelancerId) {
      throw new BadRequestException(
        'You cannot submit an offer to your own project',
      );
    }

    const existingOffer =
      await this.prisma.offer.findUnique({
        where: {
          freelancerId_projectId: {
            freelancerId,
            projectId,
          },
        },
      });

    if (existingOffer) {
      throw new ConflictException(
        'You have already submitted an offer for this project',
      );
    }

    return this.prisma.offer.create({
      data: {
        price: dto.price,
        durationDays: dto.durationDays,
        message: dto.message,
        freelancerId,
        projectId,
      },
    });
  }

  // 2. Get freelancer's own offers
  async findMyOffers(
    freelancerId: string,
    role: string,
  ) {
    if (role !== 'FREELANCER') {
      throw new ForbiddenException(
        'Only freelancers can view their offers',
      );
    }

    return this.prisma.offer.findMany({
      where: { freelancerId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            budget: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // 3. Get offers for client's project
  async findProjectOffers(
    clientId: string,
    role: string,
    projectId: string,
  ) {
    if (role !== 'CLIENT') {
      throw new ForbiddenException(
        'Only clients can view project offers',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException(
        'You can only view offers for your own projects',
      );
    }

    return this.prisma.offer.findMany({
      where: { projectId },
      include: {
        freelancer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // 4. Update an offer
  async update(
    freelancerId: string,
    role: string,
    offerId: string,
    dto: UpdateOfferDto,
  ) {
    if (role !== 'FREELANCER') {
      throw new ForbiddenException(
        'Only freelancers can update offers',
      );
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'At least one field must be provided',
      );
    }

    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        project: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.freelancerId !== freelancerId) {
      throw new ForbiddenException(
        'You can only update your own offers',
      );
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending offers can be updated',
      );
    }

    if (offer.project.status !== 'OPEN') {
      throw new BadRequestException(
        'Offers for this project can no longer be updated',
      );
    }

    return this.prisma.offer.update({
      where: { id: offerId },
      data: dto,
    });
  }

  // 5. Accept an offer
 

async acceptOffer(
  clientId: string,
  role: string,
  projectId: string,
  offerId: string,
  expectedPrice?: number,
) {
  if (role !== 'CLIENT') {
    throw new ForbiddenException(
      'Only clients can accept offers',
    );
  }

  if (expectedPrice === undefined || expectedPrice === null) {
    throw new BadRequestException('expectedPrice is required');
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const project = await tx.project.findUnique({
            where: { id: projectId },
            select: {
              id: true,
              clientId: true,
              status: true,
            },
          });

          if (!project) {
            throw new NotFoundException('Project not found');
          }

          if (project.clientId !== clientId) {
            throw new ForbiddenException(
              'You can only accept offers for your own projects',
            );
          }

          if (project.status !== 'OPEN') {
            throw new BadRequestException(
              'This project is not open',
            );
          }

          const offer = await tx.offer.findFirst({
            where: {
              id: offerId,
              projectId,
            },
          });

          if (!offer) {
            throw new NotFoundException('Offer not found');
          }

          if (Number(offer.price) !== Number(expectedPrice)) {
            throw new ConflictException('Offer price has changed');
          }

          if (offer.status !== 'PENDING') {
            throw new BadRequestException(
              'This offer is no longer pending',
            );
          }

          const wallet = await tx.wallet.findUnique({
            where: { userId: clientId },
          });

          if (!wallet) {
            throw new NotFoundException('Wallet not found');
          }

          const reserved = await tx.wallet.updateMany({
            where: {
              id: wallet.id,
              availableBalance: {
                gte: offer.price,
              },
            },
            data: {
              availableBalance: {
                decrement: offer.price,
              },
              reservedBalance: {
                increment: offer.price,
              },
            },
          });

          if (reserved.count !== 1) {
            throw new BadRequestException(
              'Insufficient wallet balance',
            );
          }

          const updatedProject = await tx.project.updateMany({
            where: {
              id: projectId,
              clientId,
              status: 'OPEN',
            },
            data: {
              status: 'IN_PROGRESS',
              acceptedOfferId: offerId,
            },
          });

          if (updatedProject.count !== 1) {
            throw new ConflictException(
              'This project has already been assigned',
            );
          }

          const acceptedOffer = await tx.offer.updateMany({
            where: {
              id: offerId,
              projectId,
              status: 'PENDING',
            },
            data: {
              status: 'ACCEPTED',
            },
          });

          if (acceptedOffer.count !== 1) {
            throw new ConflictException(
              'This offer has already been processed',
            );
          }

          await tx.offer.updateMany({
            where: {
              projectId,
              id: { not: offerId },
              status: 'PENDING',
            },
            data: {
              status: 'REJECTED',
            },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amount: offer.price,
              type: 'RESERVE',
              referenceId: projectId,
              referenceType: 'PROJECT',
              description: 'Amount reserved for accepted offer',
            },
          });

          return {
            message: 'Offer accepted successfully',
            projectId,
            offerId,
            reservedAmount: offer.price,
          };
        },
        {
          isolationLevel: 'Serializable',
        },
      );
    } catch (error) {
      const isSerializationConflict =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034';

      if (isSerializationConflict && attempt < 3) {
        continue;
      }

      if (error instanceof ConflictException) {
        throw error;
      }

      if (isSerializationConflict) {
        throw new ConflictException('Could not accept the offer. Please try again.');
      }

      throw error;
    }
  }

  throw new ConflictException(
    'Could not accept the offer. Please try again.',
  );
}



}
