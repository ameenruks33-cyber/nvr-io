import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

function isDbUnavailable(err: unknown) {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  if (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1017' ||
    code === 'P2024'
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
    if (isDbUnavailable(exception)) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Server is waking up. Wait a few seconds and tap Try again.',
        error: 'Service Unavailable',
      });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Request failed. Try again.',
      error: 'Internal Server Error',
    });
  }
}
