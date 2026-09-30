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
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "customer_photos" (
          "customer_id" TEXT NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
          "bytes" BYTEA NOT NULL,
          "mime_type" TEXT NOT NULL,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "customer_photos_pkey" PRIMARY KEY ("customer_id")
        );
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
    // WhatsApp login OTP
    for (const sql of [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp_enabled" BOOLEAN NOT NULL DEFAULT false;`,
      `CREATE TABLE IF NOT EXISTS "login_challenges" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "purpose" TEXT NOT NULL,
        "code_hash" TEXT NOT NULL,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "consumed_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "login_challenges_user_id_fkey" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS "login_challenges_user_id_idx" ON "login_challenges"("user_id");`,
    ]) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch {
        // ignore if table not ready yet
      }
    }
    // C/O (care of) contact on customers
    for (const col of [
      `ADD COLUMN IF NOT EXISTS "care_of_name" TEXT`,
      `ADD COLUMN IF NOT EXISTS "care_of_phone" TEXT`,
      `ADD COLUMN IF NOT EXISTS "botim_number" TEXT`,
      `ADD COLUMN IF NOT EXISTS "mobile_number" TEXT`,
    ]) {
      try {
        await this.$executeRawUnsafe(`ALTER TABLE "customers" ${col};`);
      } catch {
        // ignore if table not ready yet
      }
    }
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS "petty_cash_expenses" (
        "id" TEXT PRIMARY KEY,
        "amount" DECIMAL(65,30) NOT NULL,
        "spent_on" TEXT NOT NULL,
        "purpose" TEXT NOT NULL,
        "recorded_by" TEXT NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "petty_cash_expenses_spent_on_idx" ON "petty_cash_expenses"("spent_on");`,
    ]) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch {
        // ignore if table not ready yet
      }
    }
    // 1800 is given and 2000 is repaid. Only touches rows still on the old
    // 1800/1800 setup, so it runs once.
    try {
      await this.$executeRawUnsafe(`
        UPDATE "loans"
        SET "total_payable" = 2000,
            "remaining_amount" = CASE
              WHEN "status" = 'ACTIVE' THEN GREATEST(2000 - "amount_collected", 0)
              ELSE 0
            END
        WHERE "principal_amount" = 1800 AND "total_payable" = 1800;
      `);
    } catch {
      // ignore if table not ready yet
    }

    // Accounts close only when the full total is repaid: reopen any closed early
    // (e.g. at 1800 of 2000) and restore their true remaining balance.
    try {
      await this.$executeRawUnsafe(`
        UPDATE "loans"
        SET "status" = 'ACTIVE',
            "remaining_amount" = "total_payable" - "amount_collected",
            "completed_at" = NULL,
            "closed_at" = NULL
        WHERE "status" = 'COMPLETED' AND "amount_collected" < "total_payable";
      `);
      await this.$executeRawUnsafe(`
        UPDATE "loans"
        SET "remaining_amount" = GREATEST("total_payable" - "amount_collected", 0)
        WHERE "status" = 'ACTIVE'
          AND "remaining_amount" <> GREATEST("total_payable" - "amount_collected", 0);
      `);
    } catch {
      // ignore if table not ready yet
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
