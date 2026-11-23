import { MediaInput } from '../../common/media';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PageMetaDto } from '../../common/dto/response.dto';
import { Transform, Type } from 'class-transformer';
import { Role, UserStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Custom avatar URL; null restores the default animal avatar.',
  })
  @IsOptional()
  @MediaInput()
  avatarUrl?: string | null;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class BatchUserDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  fullName: string;

  @ApiPropertyOptional({ type: String, format: 'email', nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string | null;
}

const batchUserLimit = 50;

export class CreateUsersBatchDto {
  @ApiProperty({ type: [BatchUserDto], minItems: 1, maxItems: batchUserLimit })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(batchUserLimit)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => BatchUserDto)
  users: BatchUserDto[];
}

export class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty({
    type: String,
    description:
      'Absolute effective avatar URL, including the default when unset.',
  })
  avatarUrl: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedUsersDto extends PageMetaDto {
  @ApiProperty({ type: [UserDto] })
  items: UserDto[];
}

export class BatchCreatedUserDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty({
    description: 'Generated password shown only in this response',
  })
  password: string;
}

export class BatchSkippedUserDto {
  @ApiProperty({ description: 'One-based position in the submitted batch' })
  row: number;

  @ApiProperty()
  username: string;

  @ApiProperty({ enum: ['username', 'email'] })
  field: 'username' | 'email';
}

export class CreateUsersBatchResponseDto {
  @ApiProperty({ type: [BatchCreatedUserDto] })
  created: BatchCreatedUserDto[];

  @ApiProperty({ type: [BatchSkippedUserDto] })
  skipped: BatchSkippedUserDto[];
}
