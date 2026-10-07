import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'nvr-io-api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Public security posture summary (no secrets). */
  @Public()
  @Get('security')
  security() {
    return {
      transport: {
        tls: 'required',
        hsts: 'enabled',
        androidCertificatePinning: true,
      },
      atRest: {
        algorithm: 'AES-256-GCM',
        fields: [
          'passport',
          'aadhaar',
          'customer_photos',
          'gallery_images',
          'gallery_captions_notes',
          'repayment_notes',
          'whatsapp_token',
        ],
      },
      privacy: {
        noStoreCache: true,
        noIndex: true,
        referrerPolicy: 'no-referrer',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
