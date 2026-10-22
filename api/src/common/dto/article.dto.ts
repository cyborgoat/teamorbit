import { MediaInput } from '../media';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { PageMetaDto, UserSummaryDto } from './response.dto';

export class CreateArticleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ description: 'Markdown content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @MediaInput()
  coverImageUrl?: string | null;
}

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}

export class ArticleBaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ description: 'Markdown content' })
  content: string;

  @ApiProperty({ type: String, nullable: true })
  coverImageUrl: string | null;

  @ApiProperty()
  authorId: string;

  @ApiProperty({ description: 'Times the article detail has been fetched' })
  viewCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ArticleDto extends ArticleBaseDto {
  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: UserSummaryDto })
  author: UserSummaryDto;
}

export class PaginatedArticleListDto extends PageMetaDto {
  @ApiProperty({ type: [ArticleDto] })
  items: ArticleDto[];
}
