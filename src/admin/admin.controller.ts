
import {
  Controller,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { RolesGuard } from '../common/guards/Roles.guard.js';
import { Roles } from '../common/decorator/Roles.decorator.js';

@Controller('admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('users/:userId/ban')
  async banUser(
    @CurrentUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.banUser(adminId, userId);
  }

  @Patch('users/:userId/unban')
  async unbanUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.unbanUser(userId);
  }
}
