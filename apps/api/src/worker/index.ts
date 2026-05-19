import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrapWorker() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  logger.log('Cards hub Worker started');
  logger.log('Registered queues: export, cleanup, stats, search-sync');

  // Keep the process alive
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrapWorker();
