import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  private cache = new Map<string, { value: string; ts: number }>();
  private readonly TTL = 30_000; // 30s cache

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < this.TTL) return cached.value;

    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (row) {
      this.cache.set(key, { value: row.value, ts: Date.now() });
      return row.value;
    }
    return null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    this.cache.set(key, { value, ts: Date.now() });
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value);
    }
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemConfig.findMany();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
      this.cache.set(row.key, { value: row.value, ts: Date.now() });
    }
    return result;
  }
}
