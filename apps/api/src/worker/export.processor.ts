import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  buildPlatformExport,
  cardDataToSillyTavernV2,
  cardDataToTavernAI,
} from '@cards-hub/shared';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

@Processor('export')
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);
  private storageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
    this.storageDir = this.config.get<string>('STORAGE_DIR', './storage');
  }

  async process(job: Job<{ cardId: string; format: string }>) {
    const { cardId, format } = job.data;
    this.logger.log(`Exporting card ${cardId} as ${format}`);

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { tags: { include: { tag: true } }, files: true },
    });
    if (!card) throw new Error(`Card ${cardId} not found`);

    const cardData = (card.content as any).data ?? {};
    let jsonContent: object;

    switch (format) {
      case 'sillytavern_v2':
        jsonContent = cardDataToSillyTavernV2(cardData);
        break;
      case 'tavernai':
        jsonContent = cardDataToTavernAI(cardData);
        break;
      default:
        jsonContent = buildPlatformExport({
          title: card.title,
          description: card.description ?? undefined,
          content: card.content as any,
          tags: card.tags.map((t) => t.tag.name),
          visibility: card.visibility,
          price: card.price,
          files: card.files.map((f) => ({
            filename: f.filename,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            visibility: f.visibility,
          })),
        });
    }

    const exportDir = join(this.storageDir, 'exports');
    if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true });

    const filename = `${cardId}-${format}-${Date.now()}.json`;
    const filePath = join(exportDir, filename);
    const jsonStr = JSON.stringify(jsonContent, null, 2);

    writeFileSync(filePath, jsonStr);

    await this.prisma.cardExport.create({
      data: {
        cardId,
        format: format as any,
        filePath: `exports/${filename}`,
        sizeBytes: Buffer.byteLength(jsonStr),
      },
    });

    this.logger.log(`Exported card ${cardId} to ${filePath}`);
    return { filePath, sizeBytes: Buffer.byteLength(jsonStr) };
  }
}
