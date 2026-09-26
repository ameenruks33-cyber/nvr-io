import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    // Ensure gallery number-password table exists on Neon (idempotent)
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "app_settings" (
          "id" TEXT NOT NULL,
          "gallery_pin_hash" TEXT,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
        );
      `);
    } catch {
      // Local / non-Postgres environments may not support this DDL
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
