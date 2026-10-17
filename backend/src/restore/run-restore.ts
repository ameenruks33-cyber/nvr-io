import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RestoreService } from './restore.service';

function loadEnvFile(path: string) {
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(resolve(__dirname, '../../.env.vercel'));
  const date = process.env.RESTORE_DATE || '2026-10-17';
  const time = process.env.RESTORE_TIME || '11:00';
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const prisma = new PrismaService();
  await prisma.$connect();
  const restore = new RestoreService(prisma, new AuditService(prisma));

  const preview = await restore.preview(date, time);
  console.log(
    JSON.stringify(
      {
        at: preview.at,
        date: preview.date,
        time: preview.time,
        totals: preview.totals,
      },
      null,
      2,
    ),
  );

  if (process.env.RESTORE_PREVIEW_ONLY === '1') {
    await prisma.$disconnect();
    return;
  }

  if (process.env.RESTORE_CONFIRM !== '1') {
    throw new Error('Set RESTORE_CONFIRM=1 to apply the restore');
  }

  const result = await restore.restoreTo(date, time);
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
