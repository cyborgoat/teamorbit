import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnnouncementsService } from './announcements.service';
import {
  AnnouncementDto,
  CreateAnnouncementDto,
  PaginatedAnnouncementsDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';
import { OkDto, ErrorDto } from '../common/dto/response.dto';

@ApiDefaultResponse({ type: ErrorDto })
@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedAnnouncementsDto })
  findAll(@Query() query: PaginationQueryDto) {
    return this.announcements.findAll(query.page, query.limit, query.q);
  }

  @Get(':id')
  @ApiOkResponse({ type: AnnouncementDto })
  findOne(@Param('id') id: string) {
    return this.announcements.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiCreatedResponse({ type: AnnouncementDto })
  create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.announcements.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AnnouncementDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.announcements.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOkResponse({ type: OkDto })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.announcements.remove(id, user);
  }
}
