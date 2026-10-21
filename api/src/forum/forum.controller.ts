import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import {
  CreateForumPostDto,
  ForumPostCreatedDto,
  ForumPostDetailDto,
  ForumPostDto,
  PaginatedForumPostsDto,
  UpdateForumPostDto,
  VoteDto,
  VoteResultDto,
} from './dto/forum.dto';
import { ForumService } from './forum.service';
import { ErrorDto, OkDto } from '../common/dto/response.dto';

@ApiDefaultResponse({ type: ErrorDto })
@ApiTags('forum-posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ForumController {
  constructor(private forum: ForumService) {}

  @Get('forum-posts')
  @ApiOkResponse({ type: PaginatedForumPostsDto })
  findAll(@Query() query: PaginationQueryDto) {
    return this.forum.findAll(query.page, query.limit, query.q);
  }

  @Get('forum-posts/:id')
  @ApiOkResponse({ type: ForumPostDetailDto })
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.forum.findOne(id, user.id);
  }

  @Post('forum-posts')
  @ApiCreatedResponse({ type: ForumPostCreatedDto })
  create(@Body() dto: CreateForumPostDto, @CurrentUser() user: { id: string }) {
    return this.forum.create(dto, user.id);
  }

  @Patch('forum-posts/:id')
  @ApiOkResponse({ type: ForumPostDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateForumPostDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.forum.update(id, dto, user);
  }

  @Delete('forum-posts/:id')
  @ApiOkResponse({ type: OkDto })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.forum.remove(id, user);
  }

  @Put('forum-posts/:id/vote')
  @ApiOkResponse({ type: VoteResultDto })
  votePost(
    @Param('id') id: string,
    @Body() dto: VoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.forum.votePost(id, user.id, dto);
  }
}
