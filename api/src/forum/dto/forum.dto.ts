import { ApiProperty, PartialType } from '@nestjs/swagger';
import { PageMetaDto, UserSummaryDto } from '../../common/dto/response.dto';
import { IsString, MinLength } from 'class-validator';
import { CommentDto } from '../../comments/dto/comment.dto';

export class CreateForumPostDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({
    description: 'Markdown body; use absolute image URLs returned by uploads',
  })
  @IsString()
  @MinLength(1)
  content: string;
}

export class UpdateForumPostDto extends PartialType(CreateForumPostDto) {}

/** A post as returned by PATCH (no vote or comment info). */
export class ForumPostDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ description: 'Markdown body' })
  content: string;

  @ApiProperty()
  score: number;

  @ApiProperty({ description: 'Times the post detail has been fetched' })
  viewCount: number;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: UserSummaryDto })
  author: UserSummaryDto;
}

export class ForumPostSummaryDto extends ForumPostDto {
  @ApiProperty()
  commentCount: number;
}

export class ForumPostCreatedDto extends ForumPostSummaryDto {
  @ApiProperty({
    description: 'Current user vote: 1, -1 or 0',
    enum: [1, -1, 0],
  })
  myVote: number;
}

export class PaginatedForumPostsDto extends PageMetaDto {
  @ApiProperty({ type: [ForumPostSummaryDto] })
  items: ForumPostSummaryDto[];
}

export class ForumPostDetailDto extends ForumPostDto {
  @ApiProperty({
    description: 'Current user vote: 1, -1 or 0',
    enum: [1, -1, 0],
  })
  myVote: number;

  @ApiProperty({ type: [CommentDto], description: 'Top-level comments' })
  comments: CommentDto[];
}
