import { assertCanAssignRole, assertCanModifyUser } from '../common/policies';
import { userSelect, presentUser } from '../common/media';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { paginate } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, q?: string, status?: UserStatus) {
    const { skip, take } = paginate(page, limit);
    const where = {
      ...(status ? { status: status } : {}),
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
