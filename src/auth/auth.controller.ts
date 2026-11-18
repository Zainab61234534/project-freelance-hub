
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/Register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Throttle } from '@nestjs/throttler';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // 5 محاولات في الدقيقة
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);

    res.cookie('fh_session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @HttpCode(200)
  @Post('logout')
  @UseGuards(SessionAuthGuard)
  async logout(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutUser(userId);

    res.clearCookie('fh_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      message: 'Logged out successfully',
    };
  }

  @HttpCode(200)
  @Post('logout-all')
  @UseGuards(SessionAuthGuard)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAllForUser(userId);

    res.clearCookie('fh_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      message: 'Logged out from all devices successfully',
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  getMe(@CurrentUser() user: { id: string; name: string; email: string; role: string }) {
    return {
      message: 'Authenticated successfully',
      user,
    };
  }

}


