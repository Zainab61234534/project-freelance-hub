
import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { WalletService } from './wallet.service.js';
import { DepositDto } from './dto/deposit.dto.js';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';

@Controller('wallet')
@UseGuards(SessionAuthGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
  ) {}

  // Deposit test balance
@Post('deposit')
deposit(
  @CurrentUser() user: any,
  @Body() dto: DepositDto,
  @Headers('idempotency-key') idempotencyKey: string,
) {
  return this.walletService.deposit(
    user.id,
    user.role,
    dto,
    idempotencyKey,
  );
}

  // Get my wallet
  @Get('me')
  getMyWallet(
    @CurrentUser() user: any,
  ) {
    return this.walletService.getMyWallet(user.id);
  }

  // Get my wallet transactions
  @Get('transactions')
  getTransactions(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    return this.walletService.getTransactions(
      user.id,
      page,
      limit,
    );
  }
}
