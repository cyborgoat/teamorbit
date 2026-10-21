import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiDefaultResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ErrorDto } from '../common/dto/response.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { CleanupPreviewDto, CleanupStartedDto } from './dto/upload-cleanup.dto';
import { UploadCleanupService } from './upload-cleanup.service';

@ApiTags('uploads')
@ApiBearerAuth()
@ApiDefaultResponse({ type: ErrorDto })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('uploads/cleanup')
export class UploadCleanupController {
  constructor(private readonly cleanup: UploadCleanupService) {}

  @Get()
  @ApiOkResponse({
    type: CleanupPreviewDto,
    description:
      'Reconcile uploads and preview orphan files without deleting them.',
  })
  preview(@Query() query: PaginationQueryDto) {
    return this.cleanup.preview(query.page, query.limit);
  }

  @Post()
  @HttpCode(202)
  @ApiAcceptedResponse({ type: CleanupStartedDto })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'Cleanup is already running.',
  })
  start(@CurrentUser() user: { id: string }) {
    return this.cleanup.start('manual', user.id);
  }
}
