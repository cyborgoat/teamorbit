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
import { ErrorDto, OkDto } from '../common/dto/response.dto';
import { CommentsService } from './comments.service';
import {
  CommentBaseDto,
  CommentDto,
  CommentListQueryDto,
  CommentThreadDto,
  CreateCommentDto,
  UpdateCommentDto,
  VoteDto,
  VoteResultDto,
} from './dto/comment.dto';

@ApiDefaultResponse({ type: ErrorDto })
@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private comments: CommentsService) {}

  @Get()
  @ApiOkResponse({ type: CommentThreadDto })
  list(
    @Query() query: CommentListQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.comments.listForResource(
      query.resourceType,
      query.resourceId,
      user.id,
    );
  }

  @Post()
  @ApiCreatedResponse({ type: CommentDto })
  create(@Body() dto: CreateCommentDto, @CurrentUser() user: { id: string }) {
    return this.comments.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CommentBaseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.comments.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOkResponse({ type: OkDto })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.comments.remove(id, user);
  }

  @Put(':id/vote')
  @ApiOkResponse({ type: VoteResultDto })
  vote(
    @Param('id') id: string,
    @Body() dto: VoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.comments.vote(id, user.id, dto);
  }
}
