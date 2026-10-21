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
import {
  CreateEventDto,
  EventDto,
  PaginatedEventsDto,
  UpdateEventDto,
} from './dto/event.dto';
import { EventsService } from './events.service';
import { OkDto, ErrorDto } from '../common/dto/response.dto';

@ApiDefaultResponse({ type: ErrorDto })
@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events')
export class EventsController {
  constructor(private events: EventsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedEventsDto })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.events.findAll(user.id, query.page, query.limit, query.q);
  }

  @Get(':id')
  @ApiOkResponse({ type: EventDto })
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.events.findOne(id, user.id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiCreatedResponse({ type: EventDto })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: { id: string }) {
    return this.events.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiOkResponse({ type: EventDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.events.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiOkResponse({ type: OkDto })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.events.remove(id, user.id);
  }
}
