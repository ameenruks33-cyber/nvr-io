import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { WhatsappProvider, WhatsappService } from './whatsapp.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

class SaveWhatsappSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(['green-api', 'meta', 'waha'])
  provider!: WhatsappProvider;

  @IsString()
  instanceId!: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsString()
  templateLang?: string;
}

class TestWhatsappDto {
  @IsString()
  @MinLength(8)
  phone!: string;
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  /** Daily Vercel cron — keeps a free WAHA host from sleeping. */
  @Public()
  @Get('keepalive')
  async keepalive(@Headers('authorization') auth?: string) {
    const secret = this.config.get<string>('CRON_SECRET')?.trim();
    const expected = Buffer.from(`Bearer ${secret ?? ''}`);
    const given = Buffer.from(auth ?? '');
    if (
      !secret ||
      expected.length !== given.length ||
      !timingSafeEqual(expected, given)
    ) {
      throw new UnauthorizedException();
    }
    return { waha: await this.whatsapp.wahaSessionStatus() };
  }

  @Get('status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  status() {
    return this.whatsapp.getPublicStatus();
  }

  @Get('settings')
  @Roles(UserRole.SUPER_ADMIN)
  settings() {
    return this.whatsapp.getAdminStatus();
  }

  @Put('settings')
  @Roles(UserRole.SUPER_ADMIN)
  save(@Body() dto: SaveWhatsappSettingsDto, @CurrentUser() user: AuthUser) {
    return this.whatsapp.saveSettings(dto, user);
  }

  @Post('test')
  @Roles(UserRole.SUPER_ADMIN)
  async test(@Body() dto: TestWhatsappDto) {
    return this.whatsapp.sendCollectionReceipt({
      customerName: 'Test customer',
      phone: dto.phone,
      amountPaid: 100,
      remaining: 1700,
      principal: 1800,
      receiptNumber: 'TEST-RECEIPT',
      completed: false,
    });
  }
}
