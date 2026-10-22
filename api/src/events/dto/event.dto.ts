import { MediaInput } from '../../common/media';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EventAudience } from '@prisma/client';
import { PageMetaDto, UserSummaryDto } from '../../common/dto/response.dto';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsDateString()
  startAt: string;

  @ApiProperty()
  @IsDateString()
  endAt: string;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MediaInput()
  coverImageUrl?: string | null;

  @ApiPropertyOptional({
    enum: EventAudience,
    default: EventAudience.GLOBAL,
    description: 'GLOBAL (all members) or INVITE_ONLY (recipientIds)',
  })
  @IsOptional()
  @IsEnum(EventAudience)
  audience?: EventAudience;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Invitee user ids when audience is INVITE_ONLY (creator always included)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipientIds?: string[];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class EventRecordDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  startAt: Date;

  @ApiProperty()
  endAt: Date;

  @ApiProperty()
  location: string;

  @ApiProperty({ type: String, nullable: true })
  coverImageUrl: string | null;

  @ApiProperty({ enum: EventAudience })
  audience: EventAudience;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EventDto extends EventRecordDto {
  @ApiProperty({ type: UserSummaryDto })
  createdBy: UserSummaryDto;

  @ApiProperty({
    type: [UserSummaryDto],
    description: 'Invitees when audience is INVITE_ONLY; empty for GLOBAL',
  })
  recipients: UserSummaryDto[];
}

export class PaginatedEventsDto extends PageMetaDto {
  @ApiProperty({ type: [EventDto] })
  items: EventDto[];
}
