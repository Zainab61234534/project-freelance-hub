
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DepositDto } from './dto/deposit.dto.js';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Deposit: Add test balance
 

async deposit(
  userId: string,
  role: string,
  dto: DepositDto,
  idempotencyKey: string,
) {
  if (role !== 'CLIENT') {
    throw new ForbiddenException(
      'Only clients can deposit money',
    );
  }

if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw new BadRequestException(
    'Idempotency-Key header must be between 8 and 100 characters',
    );
  }

  return this.prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

  const existingTransaction = await tx.walletTransaction.findFirst({
    where: {
        walletId: wallet.id,
        idempotencyKey,
      },
    });

  if (existingTransaction) {
    return wallet;
  }

  try {
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: {
          increment: dto.amount,
        },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: dto.amount,
        type: 'DEPOSIT',
        description: 'Test wallet deposit',
        idempotencyKey,
      },
    });

    return updatedWallet;
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return wallet;
    }

    throw error;
  }
  });
}



  // 2. Get current user's wallet
  async getMyWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: {
        id: true,
        availableBalance: true,
        reservedBalance: true,
        updatedAt: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  // 3. Get current user's transactions
  
async getTransactions(
  userId: string,
  page = 1,
  limit = 10,
) {
  // Validate pagination
  if (page < 1) {
    throw new BadRequestException(
      'Page must be at least 1',
    );
  }

  if (limit < 1 || limit > 50) {
    throw new BadRequestException(
      'Limit must be between 1 and 50',
    );
  }

  const wallet = await this.prisma.wallet.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!wallet) {
    throw new NotFoundException('Wallet not found');
  }

  const skip = (page - 1) * limit;

  const [transactions, total] =
    await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),

      this.prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

}
