import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  /** Short fingerprint that changes whenever shared data is added, edited or deleted. */
  async stamp() {
    const rows = await this.prisma.$queryRaw<Array<{ raw: string }>>`
      SELECT concat_ws('|',
        (SELECT COUNT(*) FROM "customers"), (SELECT MAX("updated_at") FROM "customers"),
        (SELECT COUNT(*) FROM "loans"), (SELECT MAX("updated_at") FROM "loans"),
        (SELECT COUNT(*) FROM "repayments"), (SELECT MAX("created_at") FROM "repayments"),
        (SELECT COUNT(*) FROM "petty_cash_expenses"), (SELECT MAX("created_at") FROM "petty_cash_expenses"),
        (SELECT COUNT(*) FROM "gallery_items"), (SELECT MAX("updated_at") FROM "gallery_items"),
        (SELECT COUNT(*) FROM "documents"),
        (SELECT COUNT(*) FROM "notifications"),
        (SELECT COUNT(*) FROM "users"), (SELECT MAX("updated_at") FROM "users"),
        (SELECT MAX("updated_at") FROM "app_settings")
      ) AS raw
    `;
    const raw = rows[0]?.raw ?? '';
    return { stamp: createHash('sha256').update(raw).digest('hex').slice(0, 16) };
  }
}
