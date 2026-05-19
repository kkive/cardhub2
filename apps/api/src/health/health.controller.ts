import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/public.decorator';
import { Response } from 'express';

@Controller('api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('live')
  @HttpCode(200)
  live() {
    return this.healthService.live();
  }

  @Public()
  @Get('health')
  async getHealth(@Res() res: Response) {
    const result = await this.healthService.check();
    const statusCode = result.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(result);
  }
}
