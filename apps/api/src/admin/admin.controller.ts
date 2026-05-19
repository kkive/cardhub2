import { Body, Controller, Get, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Public } from '../auth/public.decorator';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get('bootstrap-status')
  async bootstrapStatus() {
    return this.adminService.getBootstrapStatus();
  }

  @Public()
  @Post('bootstrap')
  async bootstrap(@Body() body: { token?: string; email?: string; password?: string }) {
    return this.adminService.bootstrap(body.token, body.email, body.password);
  }
}
