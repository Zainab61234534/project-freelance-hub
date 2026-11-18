import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';



interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };

  authSession: {
    id: string;
    userId: string;
  };
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    // 1. Read session token from cookie
    const sessionToken = request.cookies?.fh_session;

    if (!sessionToken) {
      throw new UnauthorizedException('Please login first');
    }

    // 2. Hash the token
    const tokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    // 3. Find session in database
    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isBanned: true,
          },
        },
      },
    });

    // 4. Check session existence
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    // 5. Check session expiration
    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    // 6. Check if session was revoked
    if (session.revokedAt !== null) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // 7. Check if user is banned
    if (session.user.isBanned) {
      throw new ForbiddenException('Your account is banned');
    }

    // 8. Attach authenticated user to request
    request.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    };

    request.authSession = {
      id: session.id,
      userId: session.userId,
    };

    return true;
  }
}