import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';

@Controller('api/audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles('admin')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    return this.auditService.list(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      action,
      userId,
    );
  }

  @Get('config')
  @Roles('admin')
  getConfig() {
    return this.auditService.getConfig();
  }

  @Put('config')
  @Roles('admin')
  updateConfig(@Body() body: { key: string; enabled: boolean }) {
    return this.auditService.updateConfig(body.key, body.enabled);
  }
}
