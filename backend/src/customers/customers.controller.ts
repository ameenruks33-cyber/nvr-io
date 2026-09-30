import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { assertSafeId } from '../common/safe-input';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.customers.create(dto, user, req.ip);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  list(@Query('q') q: string | undefined, @CurrentUser() user: AuthUser) {
    return this.customers.findAll(q, user);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const safeId = assertSafeId(String(id));
    return this.customers.findOne(safeId, user, req.ip);
  }

  @Get(':id/photo')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  async getPhoto(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const photo = await this.customers.getPhoto(assertSafeId(String(id)), user.id);
    res.set({
      'Content-Type': PHOTO_TYPES.includes(photo.mimeType)
        ? photo.mimeType
        : 'image/jpeg',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(photo.bytes);
  }

  @Post(':id/photo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!PHOTO_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPG, PNG or WebP photos are allowed') as never,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Photo file is required');
    return this.customers.attachPhoto(
      assertSafeId(String(id)),
      file.buffer,
      file.mimetype,
      user.id,
    );
  }
}
