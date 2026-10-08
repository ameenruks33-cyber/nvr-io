import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

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
    const otpDisabled = this.config.get('OTP_DISABLED') === 'true';
    const require2fa =
      !otpDisabled &&
      (this.config.get('REQUIRE_TWO_FACTOR') === 'true' ||
        (this.config.get('REQUIRE_TWO_FACTOR') !== 'false' &&
          this.config.get('NODE_ENV') === 'production'));
    const key = this.config.get<string>('FIELD_ENCRYPTION_KEY');
    let encryptionKeyConfigured = false;
    if (key) {
      try {
        encryptionKeyConfigured = Buffer.from(key, 'base64').length === 32;
      } catch {
        encryptionKeyConfigured = false;
      }
    }

    return {
      status:
        encryptionKeyConfigured && require2fa ? 'verified' : 'degraded',
      transport: {
        tls: 'required',
        hsts: 'enabled',
        androidCertificatePinning: true,
      },
      twoFactor: {
        required: require2fa,
        channel: 'whatsapp',
        breakGlassDisabled: !otpDisabled,
      },
      atRest: {
        algorithm: 'AES-256-GCM',
        encryptionKeyConfigured,
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
