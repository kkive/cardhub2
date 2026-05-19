import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, username: true, role: true, createdAt: true },
      }),
      this.prisma.user.count(),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async updateRole(id: string, role: 'user' | 'admin', operatorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    if (operatorId) {
      const operator = await this.prisma.user.findUnique({ where: { id: operatorId } });
      await this.auditService.log('user.role_change', operatorId, operator?.username, id, {
        targetUsername: user.username,
        from: user.role,
        to: role,
      });
    }

    return updated;
  }

  async remove(id: string, operatorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    if (operatorId) {
      const operator = await this.prisma.user.findUnique({ where: { id: operatorId } });
      await this.auditService.log('user.delete', operatorId, operator?.username, id, {
        targetUsername: user.username,
        targetEmail: user.email,
      });
    }

    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
