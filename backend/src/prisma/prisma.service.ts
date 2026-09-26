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
    // Durable gallery image column (Vercel /tmp is ephemeral without R2)
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "gallery_items"
        ADD COLUMN IF NOT EXISTS "image_bytes" BYTEA;
      `);
    } catch {
      // ignore if table not ready yet
    }
    // WhatsApp auto-receipt settings on app_settings
    const waCols = [
      `ADD COLUMN IF NOT EXISTS "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "whatsapp_provider" TEXT`,
      `ADD COLUMN IF NOT EXISTS "whatsapp_instance_id" TEXT`,
      `ADD COLUMN IF NOT EXISTS "whatsapp_token_encrypted" TEXT`,
      `ADD COLUMN IF NOT EXISTS "whatsapp_api_url" TEXT`,
      `ADD COLUMN IF NOT EXISTS "whatsapp_template_name" TEXT`,
      `ADD COLUMN IF NOT EXISTS "whatsapp_template_lang" TEXT`,
    ];
    for (const col of waCols) {
      try {
        await this.$executeRawUnsafe(
          `ALTER TABLE "app_settings" ${col};`,
        );
      } catch {
        // ignore if table not ready yet
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
