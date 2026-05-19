import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(userId: string, targetType: 'card' | 'collection', targetId: string) {
    if (targetType === 'card') {
      return this.createCardOrder(userId, targetId);
    }
    return this.createCollectionOrder(userId, targetId);
  }

  private async createCardOrder(userId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException('Card not found');
    if (card.status !== 'published') {
      throw new BadRequestException('Card is not published');
    }
    if (card.price === 0) {
      throw new BadRequestException('Card is free — no order needed');
    }

    const existing = await this.prisma.entitlement.findUnique({
      where: { userId_cardId: { userId, cardId } },
    });
    if (existing) {
      throw new BadRequestException('Already entitled to this card');
    }

    return this.prisma.order.create({
      data: {
        userId,
        targetType: 'card',
        cardId,
        amount: card.price,
        status: 'pending',
      },
    });
  }

  private async createCollectionOrder(userId: string, collectionId: string) {
    const collection = await this.prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.status !== 'published') {
      throw new BadRequestException('Collection is not published');
    }
    if (collection.price === 0) {
      throw new BadRequestException('Collection is free — no order needed');
    }

    const existing = await this.prisma.entitlement.findUnique({
      where: { userId_collectionId: { userId, collectionId } },
    });
    if (existing) {
      throw new BadRequestException('Already entitled to this collection');
    }

    return this.prisma.order.create({
      data: {
        userId,
        targetType: 'collection',
        collectionId,
        amount: collection.price,
        status: 'pending',
      },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        payments: true,
        entitlements: true,
        card: { select: { id: true, title: true, price: true } },
        collection: { select: { id: true, title: true, price: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findOneForUser(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        payments: true,
        entitlements: true,
        card: { select: { id: true, title: true, price: true } },
        collection: { select: { id: true, title: true, price: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');
    return order;
  }

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        card: { select: { id: true, title: true, price: true } },
        collection: { select: { id: true, title: true, price: true } },
      },
    });
  }

  async adminFindAll(opts: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
    targetType?: string;
  }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (opts.userId) where.userId = opts.userId;
    if (opts.status) where.status = opts.status;
    if (opts.targetType) where.targetType = opts.targetType;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          card: { select: { id: true, title: true, price: true } },
          collection: { select: { id: true, title: true, price: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async markPaid(orderId: string, provider: string, externalId: string, rawPayload?: any) {
    const lockKey = `order:paid:${orderId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
    if (!locked) return;

    try {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'paid') return;

      const entitlementData: any = {
        userId: order.userId,
        orderId,
      };
      if (order.targetType === 'collection' && order.collectionId) {
        entitlementData.collectionId = order.collectionId;
      } else if (order.cardId) {
        entitlementData.cardId = order.cardId;
      }

      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'paid' },
        }),
        this.prisma.paymentEvent.create({
          data: {
            orderId,
            provider: provider as any,
            externalId,
            status: 'succeeded',
            amount: order.amount,
            rawPayload,
          },
        }),
        this.prisma.entitlement.create({
          data: entitlementData,
        }),
      ]);
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
