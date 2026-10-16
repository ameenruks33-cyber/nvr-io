import { Prisma } from '@prisma/client';

const RETRY_CODES = new Set(['P2002', 'P2024', 'P2028', 'P2034']);

export function prismaErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code?: string }).code || '');
  }
  return '';
}

export function isRetryablePrismaError(err: unknown): boolean {
  return RETRY_CODES.has(prismaErrorCode(err));
}

export function isPrismaKnownError(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

export async function retryPrisma<T>(
  fn: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryablePrismaError(err) || i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 70 * i * i));
    }
  }
  throw last;
}

export function nextReceiptFromLatest(latest?: string | null): string {
  const m = String(latest || '').match(/(\d+)$/);
  const seq = m ? Number(m[1]) + 1 : 1;
  const n = Number.isFinite(seq) && seq > 0 ? seq : 1;
  return `JB-RCP-${String(n).padStart(8, '0')}`;
}
