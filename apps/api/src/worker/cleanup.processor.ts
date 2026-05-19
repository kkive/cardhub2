import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';

@Processor('cleanup')
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);
  private storageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
    this.storageDir = this.config.get<string>('STORAGE_DIR', './storage');
  }

  async process(job: Job<{ type: string }>) {
    const { type } = job.data;
    this.logger.log(`Running cleanup: ${type}`);

    switch (type) {
      case 'orphaned-exports':
        return this.cleanupOrphanedExports();
      case 'old-webhooks':
        return this.cleanupOldWebhooks();
      default:
        this.logger.warn(`Unknown cleanup type: ${type}`);
    }
  }

  private async cleanupOrphanedExports() {
    const exportDir = join(this.storageDir, 'exports');
    if (!existsSync(exportDir)) return;

    const dbExports = await this.prisma.cardExport.findMany({
      select: { filePath: true },
    });
    const dbPaths = new Set(dbExports.map((e) => e.filePath));

    const files = readdirSync(exportDir);
    let removed = 0;

    for (const file of files) {
      const relPath = `exports/${file}`;
      if (!dbPaths.has(relPath)) {
        const fullPath = join(exportDir, file);
        try {
          unlinkSync(fullPath);
          removed++;
        } catch {
          // ignore
        }
      }
    }

    this.logger.log(`Cleaned up ${removed} orphaned export files`);
    return { removed };
  }

  private async cleanupOldWebhooks() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.webhookReceipt.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    this.logger.log(`Cleaned up ${result.count} old webhook receipts`);
    return { removed: result.count };
  }
}
