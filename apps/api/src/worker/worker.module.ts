import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule, REDIS_CLIENT } from '../redis/redis.module';
import { MeilisearchModule, MEILISEARCH_CLIENT } from '../meilisearch/meilisearch.module';
import { ExportProcessor } from './export.processor';
import { SearchSyncProcessor } from './search-sync.processor';
import { CleanupProcessor } from './cleanup.processor';
import { StatsProcessor } from './stats.processor';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    MeilisearchModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'export' },
      { name: 'cleanup' },
      { name: 'stats' },
      { name: 'search-sync' },
    ),
  ],
  providers: [ExportProcessor, SearchSyncProcessor, CleanupProcessor, StatsProcessor],
})
export class WorkerModule {}
