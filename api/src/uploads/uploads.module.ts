import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadCleanupController } from './upload-cleanup.controller';
import { UploadsController } from './uploads.controller';
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const destination = config.getOrThrow<string>('UPLOAD_DIR');
        mkdirSync(destination, { recursive: true });
        return {
          storage: diskStorage({
            destination,
            filename: (_req, file, cb) =>
              cb(
                null,
                `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
              ),
          }),
          limits: { fileSize: 5 * 1024 * 1024 },
          fileFilter: (_req, file, cb) =>
            file.mimetype.startsWith('image/')
              ? cb(null, true)
              : cb(
                  new BadRequestException('Only image uploads are allowed'),
                  false,
                ),
        };
      },
    }),
  ],
  controllers: [UploadsController, UploadCleanupController],
  providers: [UploadCleanupService],
})
export class UploadsModule {}
