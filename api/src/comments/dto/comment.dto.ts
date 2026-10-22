import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserSummaryDto } from '../../common/dto/response.dto';
import { COMMENT_RESOURCE_TYPES } from '../content-ref.service';

export class CommentListQueryDto {
  @ApiProperty({ enum: COMMENT_RESOURCE_TYPES })
  @IsIn([...COMMENT_RESOURCE_TYPES])
  resourceType: (typeof COMMENT_RESOURCE_TYPES)[number];

  @ApiProperty()
  @IsUUID()
  resourceId: string;
}

export class CreateCommentDto {
  @ApiProperty({ enum: COMMENT_RESOURCE_TYPES })
  @IsIn([...COMMENT_RESOURCE_TYPES])
  resourceType: (typeof COMMENT_RESOURCE_TYPES)[number];

  @ApiProperty()
  @IsUUID()
  resourceId: string;

  @ApiProperty({ description: 'Markdown body' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    description: 'Top-level comment id to reply to (one-level nesting only)',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content: string;
}

export class CommentBaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Markdown body' })
  content: string;

  @ApiProperty()
  score: number;

  @ApiProperty({ enum: COMMENT_RESOURCE_TYPES })
  resourceType: string;

  @ApiProperty()
  resourceId: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty({ type: String, nullable: true })
  parentId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: UserSummaryDto })
  author: UserSummaryDto;
}

export class CommentReplyDto extends CommentBaseDto {
  @ApiProperty({ enum: [1, -1, 0] })
  myVote: number;
}

export class CommentDto extends CommentReplyDto {
  @ApiProperty({ type: [CommentReplyDto] })
  replies: CommentReplyDto[];
}

export class CommentThreadDto {
  @ApiProperty({ type: [CommentDto] })
  items: CommentDto[];
}
