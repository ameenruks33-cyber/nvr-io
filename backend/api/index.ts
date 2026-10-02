import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { noTraceHeaders } from '../src/common/no-trace';

let cached: Express | null = null;

async function bootstrap(): Promise<Express> {
  if (cached) return cached;

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'] },
  );

  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
  app.use(noTraceHeaders);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGINS || '*').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Clear "Cannot GET /" when opening https://nvr-io-api.vercel.app/ in a browser
  expressApp.get('/', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'nvr-io-api',
      app: 'NVR.io',
      timestamp: new Date().toISOString(),
      health: '/api/health',
      web: 'https://nvr-io-web.vercel.app',
    });
  });

  await app.init();
  cached = expressApp;
  return expressApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const server = await bootstrap();
  return server(req, res);
}
