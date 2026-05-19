import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateCollectionDto, UpdateCollectionDto, SearchCollectionDto } from './dto/create-collection.dto';
import { Prisma, ContentStatus } from '@prisma/client';
import {
  buildPlatformExport,
  cardDataToSillyTavernV2,
  cardDataToTavernAI,
} from '@cards-hub/shared';
import JSZip from 'jszip';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class CollectionService {
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

  async create(dto: CreateCollectionDto, authorId: string) {
    await this.validateCardTypes(dto.characterCardId, dto.worldbookCardId, dto.presetCardId);

    const collection = await this.prisma.collection.create({
      data: {
        title: dto.title,
        description: dto.description,
        summary: dto.summary,
        coverUrl: dto.coverUrl,
        price: dto.price ?? 0,
        status: 'draft',
        characterCardId: dto.characterCardId,
        worldbookCardId: dto.worldbookCardId,
        presetCardId: dto.presetCardId,
        authorId,
      },
      include: this.includeCards(),
    });

    return this.format(collection);
  }

  async update(id: string, dto: UpdateCollectionDto) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Collection not found');

    if (dto.characterCardId || dto.worldbookCardId || dto.presetCardId) {
      await this.validateCardTypes(
        dto.characterCardId ?? existing.characterCardId,
        dto.worldbookCardId ?? existing.worldbookCardId,
        dto.presetCardId ?? existing.presetCardId,
      );
    }

    const collection = await this.prisma.collection.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        summary: dto.summary,
        coverUrl: dto.coverUrl,
        price: dto.price,
        characterCardId: dto.characterCardId,
        worldbookCardId: dto.worldbookCardId,
        presetCardId: dto.presetCardId,
      },
      include: this.includeCards(),
    });

    return this.format(collection);
  }

  async findAll(page = 1, limit = 20, q?: string, priceMin?: number, priceMax?: number, sort?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.CollectionWhereInput = {
      status: 'published' as ContentStatus,
    };

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { summary: { contains: q } },
      ];
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      where.price = {};
      if (priceMin !== undefined) (where.price as any).gte = priceMin;
      if (priceMax !== undefined) (where.price as any).lte = priceMax;
    }

    const orderBy: Prisma.CollectionOrderByWithRelationInput =
      sort === 'popular'
        ? { downloadCount: 'desc' }
        : sort === 'price_asc'
          ? { price: 'asc' }
          : sort === 'price_desc'
            ? { price: 'desc' }
            : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.includeCards(),
      }),
      this.prisma.collection.count({ where }),
    ]);

    return {
      items: items.map((c) => this.format(c)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async adminFindAll(opts: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
  }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.CollectionWhereInput = {};

    if (opts.status) {
      where.status = opts.status as ContentStatus;
    }
    if (opts.q) {
      where.OR = [
        { title: { contains: opts.q } },
        { description: { contains: opts.q } },
        { summary: { contains: opts.q } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.includeCards(),
      }),
      this.prisma.collection.count({ where }),
    ]);

    return {
      items: items.map((c) => this.format(c)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, isAdmin = false) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: this.includeCards(),
    });
    if (!collection) throw new NotFoundException('Collection not found');
    if (!isAdmin && collection.status !== 'published') {
      throw new NotFoundException('Collection not found');
    }
    return this.format(collection);
  }

  async publish(id: string) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundException('Collection not found');
    return this.prisma.collection.update({ where: { id }, data: { status: 'published' } });
  }

  async unpublish(id: string) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundException('Collection not found');
    return this.prisma.collection.update({ where: { id }, data: { status: 'draft' } });
  }

  async remove(id: string) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Collection not found');
    await this.prisma.collection.delete({ where: { id } });
    return { deleted: true };
  }

  async exportCollection(
    collectionId: string,
    format: 'platform_json' | 'sillytavern_v2' | 'tavernai',
    userId?: string,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: this.includeCards(),
    });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.status !== 'published') {
      throw new ForbiddenException('Collection is not published');
    }

    // Paid collections require entitlement check (free ones can be anonymous)
    if (collection.price > 0) {
      if (!userId) {
        throw new ForbiddenException('Paid collection requires authentication');
      }
      const entitlement = await this.prisma.entitlement.findUnique({
        where: { userId_collectionId: { userId, collectionId } },
      });
      if (!entitlement) {
        throw new ForbiddenException('No entitlement for this collection');
      }
    }

    const cards = [
      { type: 'character', card: collection.characterCard },
      { type: 'worldbook', card: collection.worldbookCard },
      { type: 'preset', card: collection.presetCard },
    ];

    const zip = new JSZip();

    // Build manifest
    const manifest = {
      collectionId: collection.id,
      title: collection.title,
      description: collection.description,
      summary: collection.summary,
      price: collection.price,
      format,
      exportedAt: new Date().toISOString(),
      cards: cards.map(({ type, card }) => ({
        id: card.id,
        title: card.title,
        type,
        cardType: (card as any).cardType,
      })),
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Convert and add each card
    for (const { type, card } of cards) {
      const cardData = ((card as any).content as any)?.data ?? {};
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
            description: (card as any).description ?? undefined,
            content: (card as any).content as any,
            tags: [],
            visibility: 'public',
            price: (card as any).price ?? 0,
            files: [],
          });
      }

      zip.file(`${type}.json`, JSON.stringify(jsonContent, null, 2));
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Write to disk
    const exportDir = join(this.storageDir, 'collection-exports');
    if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true });

    const filename = `${collectionId}-${format}-${Date.now()}.zip`;
    const filePath = join(exportDir, filename);
    writeFileSync(filePath, zipBuffer);

    // Save export record
    const exportRecord = await this.prisma.collectionExport.create({
      data: {
        collectionId,
        format: format as any,
        filePath: `collection-exports/${filename}`,
        sizeBytes: zipBuffer.length,
      },
    });

    return exportRecord;
  }

  async downloadExport(exportId: string, userId?: string) {
    const exportRecord = await this.prisma.collectionExport.findUnique({
      where: { id: exportId },
      include: { collection: { select: { id: true, status: true, price: true } } },
    });
    if (!exportRecord) throw new NotFoundException('Export not found');
    if (exportRecord.collection.status !== 'published') {
      throw new ForbiddenException('Collection is not published');
    }

    if (exportRecord.collection.price > 0) {
      if (!userId) {
        throw new ForbiddenException('Paid collection export requires authentication');
      }
      const entitlement = await this.prisma.entitlement.findUnique({
        where: { userId_collectionId: { userId, collectionId: exportRecord.collection.id } },
      });
      if (!entitlement) {
        throw new ForbiddenException('No entitlement for this paid collection');
      }
    }

    const filePath = join(this.storageDir, exportRecord.filePath);
    if (!existsSync(filePath)) throw new NotFoundException('Export file not found on disk');

    const { createReadStream } = require('fs');
    const stream = createReadStream(filePath);
    return { stream, exportRecord };
  }

  async incrementDownloadCount(id: string) {
    await this.prisma.collection.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });
  }

  private async validateCardTypes(characterCardId: string, worldbookCardId: string, presetCardId: string) {
    const cards = await this.prisma.card.findMany({
      where: {
        id: { in: [characterCardId, worldbookCardId, presetCardId] },
      },
    });

    const cardMap = new Map(cards.map((c) => [c.id, c]));

    const charCard = cardMap.get(characterCardId);
    if (!charCard || charCard.cardType !== 'character') {
      throw new BadRequestException('角色卡不存在或类型不正确');
    }
    const wbCard = cardMap.get(worldbookCardId);
    if (!wbCard || wbCard.cardType !== 'worldbook') {
      throw new BadRequestException('世界书不存在或类型不正确');
    }
    const preCard = cardMap.get(presetCardId);
    if (!preCard || preCard.cardType !== 'preset') {
      throw new BadRequestException('预设不存在或类型不正确');
    }
  }

  private includeCards() {
    return {
      characterCard: { select: { id: true, title: true, description: true, content: true, cardType: true, price: true, downloadCount: true, authorId: true } },
      worldbookCard: { select: { id: true, title: true, description: true, content: true, cardType: true, price: true, downloadCount: true, authorId: true } },
      presetCard: { select: { id: true, title: true, description: true, content: true, cardType: true, price: true, downloadCount: true, authorId: true } },
    };
  }

  private format(c: any) {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      summary: c.summary,
      coverUrl: c.coverUrl,
      status: c.status,
      price: c.price,
      downloadCount: c.downloadCount,
      characterCardId: c.characterCardId,
      worldbookCardId: c.worldbookCardId,
      presetCardId: c.presetCardId,
      authorId: c.authorId,
      characterCard: c.characterCard ?? null,
      worldbookCard: c.worldbookCard ?? null,
      presetCard: c.presetCard ?? null,
      createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
      updatedAt: c.updatedAt?.toISOString?.() ?? c.updatedAt,
    };
  }
}
