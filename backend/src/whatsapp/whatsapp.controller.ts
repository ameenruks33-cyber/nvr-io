import {
  Body,
  Controller,
  Get,
  Post,
  Put,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { WhatsappService } from './whatsapp.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

class SaveWhatsappSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(['green-api', 'meta'])
  provider!: 'green-api' | 'meta';

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
  constructor(private readonly whatsapp: WhatsappService) {}

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
