import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { Roles } from '../common/decorators/roles.decorator';
import { UsersQueryDto } from '../common/dto/pagination.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateUserDto,
  PaginatedUsersDto,
  UpdateUserDto,
  UserDto,
} from './dto/user.dto';
import { UsersService } from './users.service';
import { OkDto, ErrorDto } from '../common/dto/response.dto';

@ApiDefaultResponse({ type: ErrorDto })
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiOkResponse({ type: PaginatedUsersDto })
  findAll(@Query() query: UsersQueryDto) {
    return this.users.findAll(query.page, query.limit, query.q, {
      status: query.status,
      role: query.role,
      sortBy: query.sortBy,
      order: query.order,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiOkResponse({ type: UserDto })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiCreatedResponse({ type: UserDto })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: { role: Role }) {
    return this.users.create(dto, user.role);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiOkResponse({ type: UserDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.users.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPERUSER)
  @ApiOkResponse({ type: OkDto })
  remove(@Param('id') id: string, @CurrentUser() user: { role: Role }) {
    return this.users.remove(id, user.role);
  }
}
