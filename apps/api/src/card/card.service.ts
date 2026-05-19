import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MEILISEARCH_CLIENT } from '../meilisearch/meilisearch.module';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SearchCardDto } from './dto/search-card.dto';
import { Prisma, CardVisibility, CardType, ContentStatus } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';
import Redis from 'ioredis';

const MEILI_INDEX = 'cards';

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(MEILISEARCH_CLIENT) private readonly meili: MeiliSearch,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(dto: CreateCardDto, authorId: string) {
    const { tags, ...rest } = dto;
    const content: any = { cardType: dto.cardType, data: rest.content ?? {} };

    const card = await this.prisma.card.create({
      data: {
        title: rest.title,
        description: rest.description,
        content,
        cardType: dto.cardType as CardType,
        status: 'draft',
        visibility: (rest.visibility as CardVisibility) ?? CardVisibility.public,
        price: rest.price ?? 0,
        authorId,
        tags: tags
          ? {
              create: await Promise.all(
                tags.map(async (tagName) => {
                  const slug = tagName.toLowerCase().replace(/\s+/g, '-');
                  const tag = await this.prisma.tag.upsert({
                    where: { slug },
                    update: {},
                    create: { name: tagName, slug },
                  });
                  return { tagId: tag.id };
                }),
              ),
            }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    await this.syncToSearch(card.id);

    const author = await this.prisma.user.findUnique({ where: { id: authorId } });
    await this.auditService.log('card.create', authorId, author?.username, card.id, {
      title: card.title,
      cardType: dto.cardType,
    });

    return this.formatCard(card);
  }

  async findAll(page = 1, limit = 20, includeAdminDrafts = false) {
    const skip = (page - 1) * limit;
    const where: Prisma.CardWhereInput = includeAdminDrafts
      ? {}
      : { status: 'published' as ContentStatus, visibility: CardVisibility.public };
    const [items, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { tags: { include: { tag: true } } },
      }),
      this.prisma.card.count({ where }),
    ]);

    return {
      items: items.map((c) => this.formatCard(c)),
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
    cardType?: string;
  }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.CardWhereInput = {};

    if (opts.status) {
      where.status = opts.status as ContentStatus;
    }
    if (opts.cardType) {
      where.cardType = opts.cardType as CardType;
    }
    if (opts.q) {
      where.OR = [
        { title: { contains: opts.q } },
        { description: { contains: opts.q } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { tags: { include: { tag: true } } },
      }),
      this.prisma.card.count({ where }),
    ]);

    return {
      items: items.map((c) => this.formatCard(c)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, isAdmin = false) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, files: true },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (!isAdmin && card.status !== 'published') {
      throw new NotFoundException('Card not found');
    }
    return this.formatCard(card);
  }

  async publish(id: string) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Card not found');
    return this.prisma.card.update({ where: { id }, data: { status: 'published' } });
  }

  async unpublish(id: string) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Card not found');
    return this.prisma.card.update({ where: { id }, data: { status: 'draft' } });
  }

  async update(id: string, dto: UpdateCardDto, operatorId?: string) {
    const existing = await this.prisma.card.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Card not found');

    const { tags, content, ...rest } = dto;

    const card = await this.prisma.card.update({
      where: { id },
      data: {
        ...rest,
        visibility: rest.visibility as CardVisibility | undefined,
        cardType: rest.cardType ? (rest.cardType as CardType) : undefined,
        content: content
          ? ({ cardType: rest.cardType ?? (existing.content as any).cardType ?? 'character', data: content } as any)
          : undefined,
        ...(tags
          ? {
              tags: {
                deleteMany: {},
                create: await Promise.all(
                  tags.map(async (tagName) => {
                    const slug = tagName.toLowerCase().replace(/\s+/g, '-');
                    const tag = await this.prisma.tag.upsert({
                      where: { slug },
                      update: {},
                      create: { name: tagName, slug },
                    });
                    return { tagId: tag.id };
                  }),
                ),
              },
            }
          : {}),
      },
      include: { tags: { include: { tag: true } } },
    });

    // Save version
    const versionCount = await this.prisma.cardVersion.count({ where: { cardId: id } });
    await this.prisma.cardVersion.create({
      data: { cardId: id, version: versionCount + 1, content: card.content as any },
    });

    await this.syncToSearch(card.id);

    if (operatorId) {
      const operator = await this.prisma.user.findUnique({ where: { id: operatorId } });
      await this.auditService.log('card.update', operatorId, operator?.username, id, {
        title: card.title,
        changes: Object.keys(dto),
      });
    }

    return this.formatCard(card);
  }

  async remove(id: string, operatorId?: string) {
    const existing = await this.prisma.card.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Card not found');

    if (operatorId) {
      const operator = await this.prisma.user.findUnique({ where: { id: operatorId } });
      await this.auditService.log('card.delete', operatorId, operator?.username, id, {
        title: existing.title,
        cardType: existing.cardType,
      });
    }

    await this.prisma.card.delete({ where: { id } });
    await this.removeFromSearch(id);
    return { deleted: true };
  }

  async search(dto: SearchCardDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);

    try {
      return await this.searchMeili(dto, page, limit);
    } catch {
      return this.searchDb(dto, page, limit);
    }
  }

  private async searchMeili(dto: SearchCardDto, page: number, limit: number) {
    const index = this.meili.index(MEILI_INDEX);
    const filters: string[] = ['visibility = public', 'status = published'];

    if (dto.cardType) {
      filters.push(`cardType = "${dto.cardType}"`);
    }
    if (dto.priceMin !== undefined) {
      filters.push(`price >= ${dto.priceMin}`);
    }
    if (dto.priceMax !== undefined) {
      filters.push(`price <= ${dto.priceMax}`);
    }

    const sortMap: Record<string, string> = {
      newest: 'createdAt:desc',
      popular: 'downloadCount:desc',
      price_asc: 'price:asc',
      price_desc: 'price:desc',
    };

    const result = await index.search(dto.q ?? '', {
      filter: filters.length ? filters.join(' AND ') : undefined,
      sort: dto.sort && sortMap[dto.sort] ? [sortMap[dto.sort]] : undefined,
      offset: (page - 1) * limit,
      limit,
    });

    return {
      items: result.hits,
      total: result.estimatedTotalHits ?? result.hits.length,
      page,
      limit,
      pages: Math.ceil((result.estimatedTotalHits ?? result.hits.length) / limit),
    };
  }

  private async searchDb(dto: SearchCardDto, page: number, limit: number) {
    const where: Prisma.CardWhereInput = {
      visibility: CardVisibility.public,
      status: 'published' as ContentStatus,
    };

    if (dto.q) {
      where.OR = [
        { title: { contains: dto.q } },
        { description: { contains: dto.q } },
      ];
    }
    if (dto.cardType) {
      where.cardType = dto.cardType as CardType;
    }
    if (dto.priceMin !== undefined || dto.priceMax !== undefined) {
      where.price = {};
      if (dto.priceMin !== undefined) where.price.gte = dto.priceMin;
      if (dto.priceMax !== undefined) where.price.lte = dto.priceMax;
    }

    const orderBy: Prisma.CardOrderByWithRelationInput =
      dto.sort === 'popular'
        ? { downloadCount: 'desc' }
        : dto.sort === 'price_asc'
          ? { price: 'asc' }
          : dto.sort === 'price_desc'
            ? { price: 'desc' }
            : { createdAt: 'desc' };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { tags: { include: { tag: true } } },
      }),
      this.prisma.card.count({ where }),
    ]);

    return {
      items: items.map((c) => this.formatCard(c)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async syncToSearch(cardId: string) {
    try {
      const card = await this.prisma.card.findUnique({
        where: { id: cardId },
        include: { tags: { include: { tag: true } } },
      });
      if (!card) return;

      const index = this.meili.index(MEILI_INDEX);
      await index.addDocuments([
        {
          id: card.id,
          title: card.title,
          description: card.description ?? '',
          cardType: card.cardType,
          status: card.status,
          tags: card.tags.map((t) => t.tag.name),
          visibility: card.visibility,
          price: card.price,
          downloadCount: card.downloadCount,
          authorId: card.authorId,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        },
      ]);

      await this.prisma.searchSyncState.upsert({
        where: { entityType_entityId: { entityType: 'card', entityId: cardId } },
        update: { syncedAt: new Date(), version: { increment: 1 } },
        create: { entityType: 'card', entityId: cardId, syncedAt: new Date() },
      });
    } catch {
      // Meilisearch unavailable — skip silently
    }
  }

  async removeFromSearch(cardId: string) {
    try {
      const index = this.meili.index(MEILI_INDEX);
      await index.deleteDocument(cardId);
      await this.prisma.searchSyncState.deleteMany({
        where: { entityType: 'card', entityId: cardId },
      });
    } catch {
      // Meilisearch unavailable — skip silently
    }
  }

  private formatCard(card: any) {
    return {
      id: card.id,
      title: card.title,
      description: card.description,
      content: card.content,
      cardType: card.cardType,
      status: card.status,
      visibility: card.visibility,
      price: card.price,
      downloadCount: card.downloadCount,
      authorId: card.authorId,
      tags: card.tags?.map((t: any) => t.tag?.name ?? t.name) ?? [],
      files: card.files ?? [],
      createdAt: card.createdAt?.toISOString?.() ?? card.createdAt,
      updatedAt: card.updatedAt?.toISOString?.() ?? card.updatedAt,
    };
  }
}
