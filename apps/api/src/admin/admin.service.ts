import { Injectable, BadRequestException, UnauthorizedException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const envPassword = this.config.get<string>('ADMIN_PASSWORD');
    if (!envPassword) return;

    if (envPassword.length < 8) {
      this.logger.warn('ADMIN_PASSWORD is less than 8 characters - skipping auto admin creation');
      return;
    }

    const adminCount = await this.prisma.user.count({ where: { role: 'admin' } });
    if (adminCount > 0) return;

    const envEmail = this.config.get<string>('ADMIN_EMAIL', 'admin@cardshub.local')!;
    const passwordHash = await bcrypt.hash(envPassword, SALT_ROUNDS);

    await this.prisma.user.upsert({
      where: { email: envEmail },
      update: { role: 'admin', passwordHash },
      create: {
        email: envEmail,
        username: envEmail.split('@')[0],
        role: 'admin',
        passwordHash,
      },
    });
    this.logger.log(`Auto-created admin from env: ${envEmail}`);
  }

  async getBootstrapStatus() {
    const adminCount = await this.prisma.user.count({ where: { role: 'admin' } });
    return {
      hasAdmin: adminCount > 0,
      adminCount,
    };
  }

  async bootstrap(token?: string, email?: string, password?: string) {
    const { hasAdmin } = await this.getBootstrapStatus();
    if (hasAdmin) {
      throw new BadRequestException('Admin already exists. Use admin login instead.');
    }

    // Token-based: validate token, still require password for new admin
    if (token) {
      const record = await this.prisma.adminBootstrapToken.findUnique({ where: { token } });
      if (!record || record.used) {
        throw new UnauthorizedException('Invalid or used bootstrap token');
      }

      if (!password || password.length < 8) {
        throw new BadRequestException('Password (min 8 chars) is required');
      }

      const adminEmail = email ?? this.config.get<string>('ADMIN_EMAIL', 'admin@cardshub.local')!;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const admin = await this.prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: 'admin', passwordHash },
        create: {
          email: adminEmail,
          username: adminEmail.split('@')[0],
          role: 'admin',
          passwordHash,
        },
      });

      await this.prisma.adminBootstrapToken.update({
        where: { id: record.id },
        data: { used: true, usedBy: admin.id, usedAt: new Date() },
      });

      return { success: true, adminId: admin.id, email: admin.email };
    }

    // Email + password bootstrap (primary path)
    if (email && password) {
      if (password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const admin = await this.prisma.user.upsert({
        where: { email },
        update: { role: 'admin', passwordHash },
        create: {
          email,
          username: email.split('@')[0],
          role: 'admin',
          passwordHash,
        },
      });

      return { success: true, adminId: admin.id, email: admin.email };
    }

    // No token, no email/password -> generate a bootstrap token for backward compat
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
