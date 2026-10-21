import {
  Controller,
  Delete,
  Get,
  Param,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  MarkAllReadDto,
  NotificationListQueryDto,
  NotificationReadDto,
  PaginatedNotificationsDto,
} from './dto/notification.dto';
import { ErrorDto, OkDto } from '../common/dto/response.dto';

@ApiDefaultResponse({ type: ErrorDto })
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedNotificationsDto })
  list(
    @CurrentUser() user: { id: string },
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notifications.listForUser(
      user.id,
      query.page,
      query.limit,
      query.status,
    );
  }

  @Post('read-all')
  @ApiOkResponse({ type: MarkAllReadDto })
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @ApiCreatedResponse({ type: NotificationReadDto })
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Delete(':id/read')
  @ApiOkResponse({ type: OkDto })
  markUnread(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notifications.markUnread(user.id, id);
  }

  @Post(':id/restore')
  @ApiOkResponse({ type: OkDto })
  restore(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notifications.restoreForUser(user.id, id);
  }

  @Delete(':id')
  @ApiOkResponse({ type: OkDto })
  dismiss(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notifications.dismissForUser(user.id, id);
  }
}
