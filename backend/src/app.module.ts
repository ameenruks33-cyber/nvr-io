import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { LoansModule } from './loans/loans.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { DocumentsModule } from './documents/documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StorageModule } from './storage/storage.module';
import { AdminModule } from './admin/admin.module';
import { GalleryModule } from './gallery/gallery.module';
import { HealthController } from './health.controller';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL || 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT || 100),
      },
    ]),
    PrismaModule,
    CryptoModule,
    StorageModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    LoansModule,
    RepaymentsModule,
    DocumentsModule,
    NotificationsModule,
    AuditModule,
    DashboardModule,
    AdminModule,
    GalleryModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
