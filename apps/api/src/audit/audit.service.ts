import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    action: string,
    userId?: string,
    username?: string,
    target?: string,
    detail?: Record<string, unknown>,
    ip?: string,
  ) {
    // Check if this action is enabled
    const config = await this.prisma.auditConfig.findUnique({
      where: { key: action },
    });
    if (config && !config.enabled) return;

    await this.prisma.auditLog.create({
      data: {
        userId,
        username,
        action,
        target,
        detail: (detail as any) ?? undefined,
        ip,
      },
    });
  }

  async list(page = 1, limit = 20, action?: string, userId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getConfig() {
    return this.prisma.auditConfig.findMany();
  }

  async updateConfig(key: string, enabled: boolean) {
    return this.prisma.auditConfig.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    });
  }
}
