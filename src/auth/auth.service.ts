import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UserRole } from '../generated/prisma/client.js';
import { RegisterDto } from './dto/Register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';
 
const SALT_ROUNDS = 12;

// هاش bcrypt ثابت (12 rounds) لكلمة مرور عشوائية لا تُستخدم فعلياً.
// الغرض: تنفيذ bcrypt.compare حتى عندما لا يكون البريد مسجلاً،
// كي لا يختلف زمن الرد بين بريد موجود وبريد غير موجود (timing attack).
const DUMMY_HASH =
  '$2b$12$KQgbCvtFQ.Gdk5WOlDAlF.lCuOUI3Q2QkrggzNOkvUI8HfjnFkcaO';
 
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    
  ) {}
 
 async register(dto: RegisterDto) {
  // 1. Check if email already exists
  const existingUser = await this.prisma.user.findUnique({
    where: {
      email: dto.email,
    },
  });

  if (existingUser) {
    throw new ConflictException('Email already exists');
  }

  // 2. Hash password
  const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

  // 3. Create user and wallet
  try {
    return await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          role: dto.role as UserRole,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
        },
      });

      return newUser;
    });
  } catch (error) {
    // سباق تسجيل: طلبان بنفس البريد في نفس اللحظة.
    // القيد الفريد في قاعدة البيانات هو الفيصل، فنحوّله إلى 409 بدل 500.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Email already exists');
    }

    throw error;
  }
}
 
 async login(dto: LoginDto) {
  // 1. Find user
  const user = await this.prisma.user.findUnique({
    where: {
      email: dto.email,
    },
  });

  // 2. Check password
  // ننفّذ bcrypt.compare دائماً — حتى لو البريد غير مسجّل — باستخدام DUMMY_HASH،
  // حتى يبقى زمن الرد متقارباً ولا يُستخدم لمعرفة البريدات المسجّلة.
  const isPasswordValid = await bcrypt.compare(
    dto.password,
    user?.password ?? DUMMY_HASH,
  );

  if (!user || !isPasswordValid) {
    throw new UnauthorizedException('Invalid email or password');
  }

  // 3. Check if user is banned
  if (user.isBanned) {
    throw new ForbiddenException('Your account is banned');
  }

  // 4. Create session
  const sessionToken = await this.createSession(user.id);

  // 5. Return user and session token
  return {
    sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}
  
  private async createSession(userId: string) {
  // Generate a random session token
  const sessionToken = randomBytes(32).toString('hex');

  // Hash the token before storing it
  const tokenHash = createHash('sha256')
    .update(sessionToken)
    .digest('hex');

  // Session expires after 7 days
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  );

  await this.prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  // Return the original token only once
  return sessionToken;
}
async logout(sessionToken: string) {
  if (!sessionToken) {
    return;
  }

  const tokenHash = createHash('sha256')
    .update(sessionToken)
    .digest('hex');

  await this.prisma.session.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

async logoutUser(userId: string) {
  if (!userId) {
    return;
  }

  await this.prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

async logoutAllForUser(userId: string) {
  await this.logoutUser(userId);
}

async logoutAll(sessionToken: string) {
  if (!sessionToken) {
    return;
  }

  const tokenHash = createHash('sha256')
    .update(sessionToken)
    .digest('hex');

  const currentSession = await this.prisma.session.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });

  if (!currentSession) {
    return;
  }

  await this.prisma.session.updateMany({
    where: {
      userId: currentSession.userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
}
