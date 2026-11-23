import { assertCanAssignRole, assertCanModifyUser } from '../common/policies';
import { userSelect, presentUser } from '../common/media';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { UserSortField } from '../common/dto/pagination.dto';
import { paginate } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserDto,
  CreateUsersBatchDto,
  CreateUsersBatchResponseDto,
  UpdateUserDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page = 1,
    limit = 20,
    q?: string,
    opts: {
      status?: UserStatus;
      role?: Role;
      sortBy?: UserSortField;
      order?: 'asc' | 'desc';
    } = {},
  ) {
    const { status, role, sortBy = 'createdAt', order = 'desc' } = opts;
    const { skip, take } = paginate(page, limit);
    const where = {
      // Soft-deleted users are hidden unless explicitly filtered for.
      status: status ?? { not: UserStatus.DELETED },
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { username: { contains: q } },
              { fullName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take,
        orderBy: [{ [sortBy]: order }, { id: order }],
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(presentUser), total, page, limit: take };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return presentUser(user);
  }

  async create(dto: CreateUserDto, actorRole: Role) {
    assertCanAssignRole(actorRole, dto.role);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma
      .mediaWrite((tx) =>
        tx.user.create({
          data: {
            username: dto.username,
            fullName: dto.fullName,
            email: dto.email ?? null,
            passwordHash,
            role: dto.role ?? Role.USER,
            status: dto.status ?? UserStatus.ACTIVE,
            avatarUrl: dto.avatarUrl,
          },
          select: userSelect,
        }),
      )
      .then(presentUser);
  }

  async createBatch(
    dto: CreateUsersBatchDto,
  ): Promise<CreateUsersBatchResponseDto> {
    const accounts: { password: string; data: Prisma.UserCreateInput }[] = [];
    for (const { username, fullName, email } of dto.users) {
      const password = randomBytes(18).toString('base64url');
      const passwordHash = await bcrypt.hash(password, 10);
      accounts.push({
        password,
        data: {
          username,
          fullName,
          email: email ?? null,
          passwordHash,
          role: Role.USER,
          status: UserStatus.ACTIVE,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const result: CreateUsersBatchResponseDto = { created: [], skipped: [] };
      // Let the unique indexes arbitrate conflicts, including concurrent writes.
      for (const [index, { data, password }] of accounts.entries()) {
        try {
          const user = await tx.user.create({ data, select: userSelect });
          result.created.push({ user: presentUser(user), password });
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          ) {
            throw error;
          }
          const target = error.meta?.target;
          const field: unknown = Array.isArray(target) ? target[0] : undefined;
          if (field !== 'username' && field !== 'email') throw error;
          result.skipped.push({
            row: index + 1,
            username: data.username,
            field,
          });
        }
      }
      return result;
    });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: { id: string; role: Role },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    assertCanModifyUser(actor, existing, dto.role);

    const data: Record<string, unknown> = { ...dto };
    delete data.password;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma
      .mediaWrite((tx) =>
        tx.user.update({
          where: { id },
          data,
          select: userSelect,
        }),
      )
      .then(presentUser);
  }

  async remove(id: string, actorRole: Role) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.role === Role.SUPERUSER && actorRole !== Role.SUPERUSER) {
      throw new ForbiddenException('Cannot delete superuser');
    }
    await this.prisma.mediaWrite((tx) =>
      tx.user.update({
        where: { id },
        data: { status: UserStatus.DELETED },
      }),
    );
    return { ok: true };
  }
}
