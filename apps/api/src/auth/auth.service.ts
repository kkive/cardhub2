import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async register(email: string, username: string, password: string) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === email ? '邮箱已注册' : '用户名已存在',
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, username, passwordHash },
    });

    await this.auditService.log('user.register', user.id, username, user.id, { email });

    return { id: user.id, email: user.email, username: user.username, role: user.role };
  }

  async login(emailOrUsername: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('邮箱/用户名或密码错误');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('邮箱/用户名或密码错误');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    await this.auditService.log('user.login', user.id, user.username, user.id, { emailOrUsername });

    return {
      token: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    return { id: user.id, email: user.email, username: user.username, role: user.role };
  }
}
