import { userSelect, presentUser } from '../common/media';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.mediaWrite((tx) =>
        tx.user.create({
          data: {
            username: dto.username,
            fullName: dto.fullName,
            email: dto.email ?? null,
            passwordHash,
            status: UserStatus.PENDING,
          },
          select: userSelect,
        }),
      );
      return presentUser(user);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Username or email is already in use');
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    if (!!dto.username === !!dto.email) {
      throw new BadRequestException('Provide exactly one of username or email');
    }
    const user = await this.prisma.user.findUnique({
      where: dto.username ? { username: dto.username } : { email: dto.email! },
    });
    if (!user || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.INACTIVE ||
      user.status === UserStatus.PENDING
    ) {
      throw new UnauthorizedException('Account is not active');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: presentUser({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }),
    };
  }

  async me(userId: string) {
    return this.prisma.user
      .findUniqueOrThrow({
        where: { id: userId },
        select: userSelect,
      })
      .then(presentUser);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    try {
      return await this.prisma
        .mediaWrite((tx) =>
          tx.user.update({
            where: { id: userId },
            data: {
              ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
              ...(dto.email !== undefined ? { email: dto.email } : {}),
              ...(dto.avatarUrl !== undefined
                ? { avatarUrl: dto.avatarUrl }
                : {}),
            },
            select: userSelect,
          }),
        )
        .then(presentUser);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw err;
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.mediaWrite((tx) =>
      tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
    );
    return { ok: true };
  }
}
