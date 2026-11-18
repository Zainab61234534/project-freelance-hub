import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { FreelancerProfileModule } from './freelancer-profile/freelancer-profile.module.js';
import { ProjectModule } from './project/project.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { APP_GUARD } from '@nestjs/core';
import { WalletModule } from './wallet/wallet.module.js';
import { OffersModule } from './offers/offers.module.js';
import { DeliveriesModule } from './deliveries/deliveries.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    FreelancerProfileModule,
    ProjectModule,
    CategoriesModule,
    WalletModule,
    OffersModule,
    DeliveriesModule,
    AdminModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
