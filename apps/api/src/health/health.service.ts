import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { MEILISEARCH_CLIENT } from '../meilisearch/meilisearch.module';
import Redis from 'ioredis';
import { MeiliSearch } from 'meilisearch';
import * as fs from 'fs';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(MEILISEARCH_CLIENT) private readonly meili: MeiliSearch,
  ) {}

  async check() {
    const [db, redis, meili, storage] = await Promise.allSettled([
      this.checkDb(),
      this.checkRedis(),
      this.checkMeili(),
      this.checkStorage(),
    ]);

    return {
      status: 'ok',
      service: 'cards-hub-api',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: this.resultToStatus(db),
        redis: this.resultToStatus(redis),
        meilisearch: this.resultToStatus(meili),
        storage: this.resultToStatus(storage),
      },
    };
  }

  private async checkDb(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis(): Promise<void> {
    const pong = await this.redis.ping();
    if (pong !== 'PONG') throw new Error('Redis ping failed');
  }

  private async checkMeili(): Promise<void> {
    await this.meili.health();
  }

  private async checkStorage(): Promise<void> {
    const storageDir = process.env.STORAGE_DIR || './storage';
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.accessSync(storageDir, fs.constants.W_OK);
  }

  private resultToStatus(result: PromiseSettledResult<void>): { ok: boolean; error?: string } {
    if (result.status === 'fulfilled') return { ok: true };
    return { ok: false, error: result.reason?.message ?? 'unknown error' };
  }
}
