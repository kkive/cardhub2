import { Inject, Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../config/system-config.service';
import { OrderService } from '../order/order.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { createHash, timingSafeEqual } from 'crypto';
import Stripe from 'stripe';

const EPAY_SORT_PARAMS = (params: Record<string, string>, key: string) =>
  Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&') + `&key=${key}`;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: SystemConfigService,
    private readonly orderService: OrderService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async getStripe(): Promise<Stripe | null> {
    if (this.stripe) return this.stripe;
    const key = await this.configService.get('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key);
      return this.stripe;
    }
    return null;
  }

  async handleStripeWebhook(body: any, signature: string) {
    const webhookSecret = await this.configService.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new BadRequestException(
        'Stripe webhook secret is not configured. Set it in the admin config page.',
      );
    }

    const stripe = await this.getStripe();
    if (!stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error(`Stripe signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const webhookId = event.id;
    if (!webhookId) throw new BadRequestException('Missing event id');

    const lockKey = `webhook:stripe:${webhookId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
    if (!locked) {
      this.logger.log(`Stripe webhook already being processed: ${webhookId}`);
      return;
    }

    try {
      const existing = await this.prisma.webhookReceipt.findUnique({
        where: { webhookId },
      });
      if (existing) {
        this.logger.log(`Duplicate Stripe webhook: ${webhookId}`);
        return;
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data?.object as Stripe.Checkout.Session;
        const orderId = session?.metadata?.orderId;
        if (orderId) {
          await this.orderService.markPaid(orderId, 'stripe', webhookId, event);
          this.logger.log(`Stripe payment completed for order ${orderId}`);
        }
      }

      await this.prisma.webhookReceipt.create({
        data: { provider: 'stripe', webhookId, payload: event as any },
      });
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async handleYiPayWebhook(body: any) {
    const secret = (await this.configService.get('YIPAY_SECRET')) || '';
    const { trade_no, out_trade_no, trade_status, sign } = body;

    const webhookId = `yipay:${trade_no}`;

    const lockKey = `webhook:yipay:${webhookId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
    if (!locked) {
      this.logger.log(`YiPay webhook already being processed: ${webhookId}`);
      return;
    }

    try {
      const existing = await this.prisma.webhookReceipt.findUnique({
        where: { webhookId },
      });
      if (existing) {
        this.logger.log(`Duplicate YiPay webhook: ${webhookId}`);
        return;
      }

      if (secret && sign) {
        const params: Record<string, string> = {};
        for (const [key, val] of Object.entries(body)) {
          if (key !== 'sign' && key !== 'sign_type' && val !== '' && val !== null && val !== undefined) {
            params[key] = String(val);
          }
        }
        const sortedStr =
          Object.keys(params)
            .sort()
            .map((k) => `${k}=${params[k]}`)
            .join('&') + secret;
        const expectedSign = createHash('md5').update(sortedStr).digest('hex');

        if (expectedSign.length !== sign.length) {
          throw new BadRequestException('Invalid YiPay signature');
        }
        const valid = timingSafeEqual(Buffer.from(expectedSign), Buffer.from(sign));
        if (!valid) {
          throw new BadRequestException('Invalid YiPay signature');
        }
      }

      if (trade_status === 'TRADE_SUCCESS' && out_trade_no) {
        await this.orderService.markPaid(out_trade_no, 'yipay', webhookId, body);
        this.logger.log(`YiPay payment completed for order ${out_trade_no}`);
      }

      await this.prisma.webhookReceipt.create({
        data: { provider: 'yipay', webhookId, payload: body },
      });
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async createEpayOrder(orderId: string, type: 'alipay' | 'wxpay' | 'qqpay') {
    const order = await this.orderService.findOne(orderId);
    if (!order) throw new BadRequestException('订单不存在');

    const [pid, key, gateway, baseUrl] = await Promise.all([
      this.configService.get('EPAY_PID'),
      this.configService.get('EPAY_KEY'),
      this.configService.get('EPAY_GATEWAY'),
      this.configService.get('BASE_URL'),
    ]);

    if (!pid || !key || !gateway) {
      throw new BadRequestException('易支付未配置完整，请在管理后台设置 EPAY_PID、EPAY_KEY、EPAY_GATEWAY');
    }

    const targetLabel = order.targetType === 'collection' ? '合集' : '卡片';
    const params: Record<string, string> = {
      pid: String(pid),
      type,
      out_trade_no: order.id,
      notify_url: `${baseUrl || ''}/api/payments/epay/notify`,
      return_url: `${baseUrl || ''}/cards`,
      name: `${targetLabel}订单 ${order.id}`,
      money: (order.amount / 100).toFixed(2),
    };

    const signStr = EPAY_SORT_PARAMS(params, String(key));
    const sign = createHash('md5').update(signStr).digest('hex');

    return {
      gateway: String(gateway).replace(/\/+$/, ''),
      params: { ...params, sign, sign_type: 'MD5' },
    };
  }

  async handleEpayNotify(body: any) {
    const { trade_no, out_trade_no, trade_status, sign } = body;
    const key = (await this.configService.get('EPAY_KEY')) || '';

    // Verify signature
    if (key && sign) {
      const params: Record<string, string> = {};
      for (const [k, val] of Object.entries(body)) {
        if (k !== 'sign' && k !== 'sign_type' && val !== '' && val != null) {
          params[k] = String(val);
        }
      }
      const expectedSign = createHash('md5')
        .update(EPAY_SORT_PARAMS(params, key))
        .digest('hex');

      if (expectedSign.length !== sign.length) {
        throw new BadRequestException('易支付签名无效');
      }
      if (!timingSafeEqual(Buffer.from(expectedSign), Buffer.from(sign))) {
        throw new BadRequestException('易支付签名无效');
      }
    }

    const webhookId = `epay:${trade_no}`;
    const lockKey = `webhook:epay:${webhookId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
    if (!locked) {
      this.logger.log(`Epay webhook already being processed: ${webhookId}`);
      return 'success';
    }

    try {
      const existing = await this.prisma.webhookReceipt.findUnique({
        where: { webhookId },
      });
      if (existing) {
        this.logger.log(`Duplicate epay webhook: ${webhookId}`);
        return 'success';
      }

      if (trade_status === 'TRADE_SUCCESS' && out_trade_no) {
        await this.orderService.markPaid(out_trade_no, 'epay', webhookId, body);
        this.logger.log(`Epay payment completed for order ${out_trade_no}`);
      }

      await this.prisma.webhookReceipt.create({
        data: { provider: 'epay', webhookId, payload: body },
      });
    } finally {
      await this.redis.del(lockKey);
    }

    return 'success';
  }
}
