import { Body, Controller, Headers, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';

@Controller('api/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Public()
  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    try {
      const rawBody = (req as any).rawBody || req.body;
      await this.paymentService.handleStripeWebhook(rawBody, signature);
      res.status(HttpStatus.OK).json({ received: true });
    } catch (err: any) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  @Public()
  @Post('yipay/webhook')
  async yipayWebhook(@Body() body: any, @Res() res: Response) {
    try {
      await this.paymentService.handleYiPayWebhook(body);
      res.status(HttpStatus.OK).send('success');
    } catch (err: any) {
      res.status(HttpStatus.BAD_REQUEST).send(err.message);
    }
  }

  @Post('epay/create')
  async createEpayOrder(
    @Body() body: { orderId: string; type: 'alipay' | 'wxpay' | 'qqpay' },
  ) {
    return this.paymentService.createEpayOrder(body.orderId, body.type);
  }

  @Public()
  @Post('epay/notify')
  async epayNotify(@Body() body: any, @Res() res: Response) {
    try {
      const result = await this.paymentService.handleEpayNotify(body);
      res.status(HttpStatus.OK).send(result);
    } catch (err: any) {
      res.status(HttpStatus.BAD_REQUEST).send(err.message);
    }
  }
}
