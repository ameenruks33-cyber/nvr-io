import { Module } from '@nestjs/common';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { GalleryUnlockService } from './gallery-unlock.service';

@Module({
  controllers: [GalleryController],
  providers: [GalleryService, GalleryUnlockService],
})
export class GalleryModule {}
