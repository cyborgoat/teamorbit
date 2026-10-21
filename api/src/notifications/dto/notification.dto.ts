import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationAudience } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PageMetaDto } from '../../common/dto/response.dto';

export enum NotificationListStatus {
  UNREAD = 'unread',
  READ = 'read',
  DISMISSED = 'dismissed',
}

export class NotificationListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: NotificationListStatus,
    description:
      'Filter inbox by read state, or list dismissed items. Omit for all non-dismissed.',
  })
  @IsOptional()
  @IsEnum(NotificationListStatus)
  status?: NotificationListStatus;
}

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: NotificationAudience,
    example: NotificationAudience.GLOBAL,
  })
  audience: NotificationAudience;

  @ApiProperty({ example: 'forum.created' })
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  resourceType: string;

  @ApiProperty()
  resourceId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Whether the current user has read it' })
  read: boolean;
}

export class PaginatedNotificationsDto extends PageMetaDto {
  @ApiProperty({ type: [NotificationDto] })
  items: NotificationDto[];
}

export class NotificationReadDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  notificationId: string;

  @ApiProperty()
  readAt: Date;
}

export class MarkAllReadDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ description: 'Number of notifications newly marked read' })
  marked: number;
}
