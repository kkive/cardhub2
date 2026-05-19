import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getBootstrapStatus() {
    const adminCount = await this.prisma.user.count({ where: { role: 'admin' } });
    return {
      hasAdmin: adminCount > 0,
      adminCount,
    };
  }

  async bootstrap(token?: string, email?: string) {
    const { hasAdmin } = await this.getBootstrapStatus();
    if (hasAdmin) {
      throw new BadRequestException('Admin already exists. Use admin login instead.');
    }

    // If token-based bootstrap
    if (token) {
      const record = await this.prisma.adminBootstrapToken.findUnique({ where: { token } });
      if (!record || record.used) {
        throw new UnauthorizedException('Invalid or used bootstrap token');
      }

      const adminEmail = email ?? this.config.get<string>('ADMIN_EMAIL', 'admin@cardshub.local')!;
      const admin = await this.prisma.user.create({
        data: {
          email: adminEmail,
          username: 'admin',
          role: 'admin',
        },
      });

      await this.prisma.adminBootstrapToken.update({
        where: { id: record.id },
        data: { used: true, usedBy: admin.id, usedAt: new Date() },
      });

      return { success: true, adminId: admin.id, email: admin.email };
    }

    // Generate a new bootstrap token
    const newToken = randomBytes(32).toString('hex');
    await this.prisma.adminBootstrapToken.create({
      data: { token: newToken },
    });

    return {
      message: 'No admin exists. Use this token to bootstrap.',
      token: newToken,
    };
  }
}
