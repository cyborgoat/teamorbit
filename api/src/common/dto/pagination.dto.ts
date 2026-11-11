import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventAudience, Role, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PaginationQueryDto {
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

  @IsOptional()
  @IsString()
  q?: string;
}

export type SortOrder = 'asc' | 'desc';

/** Paginated query that also accepts `sortBy` (whitelisted) and `order`. */
function sortable<const F extends readonly string[]>(fields: F) {
  class SortableQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ enum: fields })
    @IsOptional()
    @IsIn(fields)
    sortBy?: F[number];

    @ApiPropertyOptional({ enum: ['asc', 'desc'] })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    order?: SortOrder;
  }
  return SortableQueryDto;
}

/** Builds a stable Prisma `orderBy`, falling back to the resource default. */
export function buildOrderBy(
  sortBy: string | undefined,
  order: SortOrder | undefined,
  fallback: Record<string, SortOrder>[],
) {
  if (!sortBy && !order) return [...fallback, { id: 'desc' as const }];
  const first = sortBy ?? Object.keys(fallback[0])[0];
  const dir = order ?? fallback[0][first] ?? 'desc';
  return [{ [first]: dir }, { id: dir }];
}

export class ArticleQueryDto extends sortable([
  'createdAt',
  'title',
  'viewCount',
] as const) {
  @IsOptional()
  @IsString()
  tag?: string;
}

export class AnnouncementQueryDto extends sortable([
  'createdAt',
  'title',
] as const) {}

export class ForumQueryDto extends sortable([
  'score',
  'createdAt',
  'title',
  'viewCount',
] as const) {}

export class EventsQueryDto extends sortable([
  'startAt',
  'createdAt',
  'title',
] as const) {
  @IsOptional()
  @IsEnum(EventAudience)
  audience?: EventAudience;
}

export const USER_SORT_FIELDS = [
  'createdAt',
  'fullName',
  'username',
  'role',
  'status',
] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class UsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
