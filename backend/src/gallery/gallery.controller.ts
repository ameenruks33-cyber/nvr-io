import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GalleryStatus, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { Readable } from 'stream';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { assertSafeId } from '../common/safe-input';
import { GalleryService } from './gallery.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

class VerifyGalleryDto {
  @IsEnum(GalleryStatus)
  status!: GalleryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class GalleryPinDto {
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'PIN must be 4–8 digits' })
  pin!: string;
}

@Controller('gallery')
export class GalleryController {
  constructor(
    private readonly gallery: GalleryService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  @Get('pin-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  pinStatus() {
    return this.gallery.pinStatus();
  }

  @Post('pin')
  @Roles(UserRole.SUPER_ADMIN)
  setPin(@Body() dto: GalleryPinDto, @CurrentUser() user: AuthUser) {
    return this.gallery.setPin(dto.pin, user);
  }

  @Post('unlock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  unlock(@Body() dto: GalleryPinDto, @CurrentUser() user: AuthUser) {
    return this.gallery.unlock(dto.pin, user);
  }

  @Post('upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Only image uploads are allowed') as never,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Body('caption') caption?: string,
    @Body('note') note?: string,
    @Body('customerId') customerId?: string,
  ) {
    return this.gallery.upload(file, user, {
      caption,
      note,
      customerId: customerId ? assertSafeId(String(customerId)) : undefined,
    });
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  list(
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    let parsed: GalleryStatus | undefined;
    if (status) {
      if (!Object.values(GalleryStatus).includes(status as GalleryStatus)) {
        throw new BadRequestException('Invalid status filter');
      }
      parsed = status as GalleryStatus;
    }
    return this.gallery.list(parsed, user);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  getOne(@Param('id') id: string) {
    return this.gallery.getOne(assertSafeId(String(id)));
  }

  @Get(':id/file')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  async getFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeId = assertSafeId(String(id));
    const item = await this.gallery.getFilePayload(safeId);

    res.set({
      'Content-Type': item.mimeType || 'image/jpeg',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    try {
      let stream: Readable;
      if (item.imageBytes && item.imageBytes.length > 0) {
        stream = Readable.from(Buffer.from(item.imageBytes));
      } else {
        stream = await this.storage.openStream(item.storageKey);
      }

      await this.audit.log({
        userId: user.id,
        action: 'GALLERY_ACCESS',
        recordType: 'gallery',
        recordId: item.id,
      });
      return new StreamableFile(stream);
    } catch {
      throw new NotFoundException(
        'Photo file is missing from cloud storage. Capture again from Add person.',
      );
    }
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  setStatus(
    @Param('id') id: string,
    @Body() dto: VerifyGalleryDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (
      dto.status !== GalleryStatus.VERIFIED &&
      dto.status !== GalleryStatus.REJECTED
    ) {
      throw new BadRequestException('Status must be VERIFIED or REJECTED');
    }
    return this.gallery.setStatus(
      assertSafeId(String(id)),
      dto.status,
      user,
      dto.note,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.gallery.remove(assertSafeId(String(id)), user);
  }
}
