import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MEILISEARCH_CLIENT } from '../meilisearch/meilisearch.module';
import { MeiliSearch } from 'meilisearch';

const MEILI_INDEX = 'cards';

@Processor('search-sync')
export class SearchSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEILISEARCH_CLIENT) private readonly meili: MeiliSearch,
  ) {
    super();
  }

  async process(job: Job<{ cardId?: string; fullSync?: boolean }>) {
    const { cardId, fullSync } = job.data;

    if (fullSync) {
      return this.fullSync();
    }

    if (cardId) {
      return this.syncOne(cardId);
    }

    // Sync all unsynced cards
    return this.syncPending();
  }

  private async syncOne(cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { tags: { include: { tag: true } } },
    });
    if (!card) return;

    try {
      const index = this.meili.index(MEILI_INDEX);
      await index.addDocuments([
        {
          id: card.id,
          title: card.title,
          description: card.description ?? '',
          cardType: card.cardType,
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

      this.logger.log(`Synced card ${cardId} to Meilisearch`);
    } catch (err: any) {
      this.logger.warn(`Meilisearch sync failed for card ${cardId}: ${err.message}`);
    }
  }

  private async fullSync() {
    this.logger.log('Starting full search sync...');
    const cards = await this.prisma.card.findMany({
      where: { visibility: 'public' },
      include: { tags: { include: { tag: true } } },
    });

    try {
      const index = this.meili.index(MEILI_INDEX);
      const documents = cards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description ?? '',
        cardType: card.cardType,
        tags: card.tags.map((t) => t.tag.name),
        visibility: card.visibility,
        price: card.price,
        downloadCount: card.downloadCount,
        authorId: card.authorId,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
      }));

      await index.addDocuments(documents);

      // Update sync state for all
      for (const card of cards) {
        await this.prisma.searchSyncState.upsert({
          where: { entityType_entityId: { entityType: 'card', entityId: card.id } },
          update: { syncedAt: new Date(), version: { increment: 1 } },
          create: { entityType: 'card', entityId: card.id, syncedAt: new Date() },
        });
      }

      this.logger.log(`Full sync complete: ${cards.length} cards`);
    } catch (err: any) {
      this.logger.warn(`Meilisearch full sync failed: ${err.message}`);
    }
  }

  private async syncPending() {
    const cards = await this.prisma.card.findMany({
      where: { visibility: 'public' },
      include: { tags: { include: { tag: true } } },
    });

    const syncStates = await this.prisma.searchSyncState.findMany({
      where: { entityType: 'card' },
    });
    const syncMap = new Map(syncStates.map((s) => [s.entityId, s.syncedAt]));

    let synced = 0;
    for (const card of cards) {
      const lastSync = syncMap.get(card.id);
      if (!lastSync || card.updatedAt > lastSync) {
        await this.syncOne(card.id);
        synced++;
      }
    }

    this.logger.log(`Pending sync complete: ${synced} cards updated`);
  }
}
