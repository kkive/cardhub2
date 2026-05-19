import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('api/config')
@UseGuards(RolesGuard)
@Roles('admin')
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get()
  async getAll() {
    return this.configService.getAll();
  }

  @Put()
  async update(@Body() body: Record<string, string>) {
    await this.configService.setMany(body);
    return { success: true };
  }
}
