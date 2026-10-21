import { UploadCleanupService } from './upload-cleanup.service';
import { mediaUrl } from '../common/media';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadResultDto } from './dto/upload.dto';
import { ErrorDto } from '../common/dto/response.dto';

@ApiDefaultResponse({ type: ErrorDto })
@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly cleanup: UploadCleanupService) {}
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiCreatedResponse({ type: UploadResultDto })
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    await this.cleanup.register(file.filename, file.size);
    return {
      url: mediaUrl(`/uploads/${file.filename}`),
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
