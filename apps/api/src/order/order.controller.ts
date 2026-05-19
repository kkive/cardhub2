import { Body, Controller, Get, Headers, Param, Post, Query, Request, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtOptionalGuard } from '../auth/jwt-optional.guard';

const isProd = process.env.NODE_ENV === 'production';

@Public()
@UseGuards(JwtOptionalGuard)
@Controller('api/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(
    @Body()
    body: {
      targetType?: 'card' | 'collection';
      targetId?: string;
      cardId?: string;
    },
    @Request() req: { user?: { id: string } },
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
  ) {
    // In production, JWT-authenticated user is required
    if (isProd) {
      if (!req.user?.id) {
        throw new ForbiddenException('Authentication required');
      }
    }

    const userId = req.user?.id ?? devUserId ?? 'dev-user';

    // Support legacy { cardId } and new { targetType, targetId }
    const targetType = body.targetType ?? 'card';
    const targetId = body.targetId ?? body.cardId;
    if (!targetId) {
      throw new BadRequestException('targetId or cardId is required');
    }
    return this.orderService.create(userId, targetType, targetId);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('admin/list')
  adminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('targetType') targetType?: string,
  ) {
    return this.orderService.adminFindAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId,
      status,
      targetType,
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Request() req: { user?: { id: string } },
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
  ) {
    if (isProd && !req.user?.id) {
      throw new ForbiddenException('Authentication required');
    }
    const userId = req.user?.id ?? devUserId ?? 'dev-user';
    return this.orderService.findOneForUser(id, userId);
  }

  @Get()
  findByUser(
    @Request() req: { user?: { id: string } },
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
  ) {
    if (isProd && !req.user?.id) {
      throw new ForbiddenException('Authentication required');
    }
    const userId = req.user?.id ?? devUserId ?? 'dev-user';
    return this.orderService.findByUser(userId);
  }
}
