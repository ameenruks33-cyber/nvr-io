import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

function prismaCode(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err
    ? String((err as { code?: string }).code || '')
    : '';
}

function isDbUnavailable(err: unknown) {
  const code = prismaCode(err);
  if (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1017' ||
    code === 'P2024' ||
    code === 'P2028' ||
    code === 'P2034'
  ) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /can't reach database|timed out|connection|ECONNREFUSED|ENOTFOUND/i.test(
    msg,
  );
}

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientInitializationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const code = prismaCode(exception);
    console.error('Prisma request error', {
      code,
      message: exception instanceof Error ? exception.message : String(exception),
    });
    if (isDbUnavailable(exception)) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Could not save yet. Tap Save collection again.',
        error: 'Service Unavailable',
      });
      return;
    }
    if (code === 'P2002') {
      res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'This collection may already be saved. Refresh and check.',
        error: 'Conflict',
      });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Could not save. Tap Save collection again.',
      error: 'Internal Server Error',
    });
  }
}
