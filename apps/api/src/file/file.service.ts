import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import {
  buildPlatformExport,
  cardDataToSillyTavernV2,
  cardDataToTavernAI,
} from '@cards-hub/shared';

@Injectable()
export class FileService {
  private storageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.storageDir = this.config.get<string>('STORAGE_DIR', './storage');
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async upload(
    cardId: string,
    file: Express.Multer.File,
    visibility: 'public' | 'paid' = 'public',
  ) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException('Card not found');

    const subdir = visibility === 'paid' ? 'paid' : 'public';
    const dir = join(this.storageDir, subdir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const storageKey = `${subdir}/${cardId}/${file.originalname}`;
    const filePath = join(this.storageDir, storageKey);
    const fileDir = join(this.storageDir, subdir, cardId);
    if (!existsSync(fileDir)) mkdirSync(fileDir, { recursive: true });

    await pipeline(file.buffer ? require('stream').Readable.from(file.buffer) : createReadStream(file.path), createWriteStream(filePath));

    return this.prisma.fileAsset.create({
      data: {
        cardId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        visibility: visibility === 'paid' ? 'paid' : 'public',
      },
    });
  }

  async download(fileId: string, userId?: string) {
    const fileAsset = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!fileAsset) throw new NotFoundException('File not found');

    // Paid files require entitlement check
    if (fileAsset.visibility === 'paid') {
      if (!userId) {
        throw new ForbiddenException(
          'Paid file requires authentication. Pass X-Dev-User-Id header in development.',
        );
      }
      const entitlement = await this.prisma.entitlement.findUnique({
        where: { userId_cardId: { userId, cardId: fileAsset.cardId } },
      });
      if (!entitlement) {
        throw new ForbiddenException('No entitlement for this paid file');
      }
    }

    const filePath = join(this.storageDir, fileAsset.storageKey);
    if (!existsSync(filePath)) throw new NotFoundException('File not found on disk');

    const stream = createReadStream(filePath);
    return { stream, fileAsset };
  }

  async exportCard(cardId: string, format: 'platform_json' | 'sillytavern_v2' | 'tavernai', userId?: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { tags: { include: { tag: true } }, files: true },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (card.status !== 'published') {
      throw new ForbiddenException('Card is not published');
    }

    if (card.price > 0) {
      if (!userId) {
        throw new ForbiddenException('Paid card requires authentication');
      }
      const entitlement = await this.prisma.entitlement.findUnique({
        where: { userId_cardId: { userId, cardId } },
      });
      if (!entitlement) {
        throw new ForbiddenException('No entitlement for this paid card');
      }
    }

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

    const { createWriteStream: cws } = require('fs');
    const ws = cws(filePath);
    ws.write(jsonStr);
    ws.end();

    await new Promise<void>((resolve) => ws.on('finish', resolve));

    return this.prisma.cardExport.create({
      data: {
        cardId,
        format: format as any,
        filePath: `exports/${filename}`,
        sizeBytes: Buffer.byteLength(jsonStr),
      },
    });
  }

  async downloadExport(exportId: string, userId?: string) {
    const exportRecord = await this.prisma.cardExport.findUnique({
      where: { id: exportId },
      include: { card: { select: { id: true, status: true, price: true } } },
    });
    if (!exportRecord) throw new NotFoundException('Export not found');
    if (exportRecord.card.status !== 'published') {
      throw new ForbiddenException('Card is not published');
    }

    if (exportRecord.card.price > 0) {
      if (!userId) {
        throw new ForbiddenException('Paid card export requires authentication');
      }
      const entitlement = await this.prisma.entitlement.findUnique({
        where: { userId_cardId: { userId, cardId: exportRecord.card.id } },
      });
      if (!entitlement) {
        throw new ForbiddenException('No entitlement for this paid card');
      }
    }

    const filePath = join(this.storageDir, exportRecord.filePath);
    if (!existsSync(filePath)) throw new NotFoundException('Export file not found on disk');

    const stream = createReadStream(filePath);
    return { stream, exportRecord };
  }
}
