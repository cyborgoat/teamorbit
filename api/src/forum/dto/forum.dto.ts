import { ApiProperty, PartialType } from '@nestjs/swagger';
import { PageMetaDto } from '../../common/dto/response.dto';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, MinLength } from 'class-validator';
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

export class VoteDto {
  @ApiProperty({
    description: '1 = upvote, -1 = downvote, 0 = clear vote',
    enum: [1, -1, 0],
  })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, -1, 0])
  value: 1 | -1 | 0;
}

export class ForumAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  avatarUrl: string;
}

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

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: ForumAuthorDto })
  author: ForumAuthorDto;
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

export class VoteResultDto {
  @ApiProperty()
  score: number;

  @ApiProperty({ enum: [1, -1, 0] })
  myVote: number;
}
