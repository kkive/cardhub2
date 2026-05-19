import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserService } from './user.service';

@Controller('api/users')
@UseGuards(RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles('admin')
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.userService.list(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  updateRole(
    @Param('id') id: string,
    @Body() body: { role: 'user' | 'admin' },
    @Request() req: { user: { id: string } },
  ) {
    if (id === req.user.id) {
      throw new BadRequestException('不能修改自己的角色');
    }
    return this.userService.updateRole(id, body.role, req.user.id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (id === req.user.id) {
      throw new BadRequestException('不能删除自己的账号');
    }
    return this.userService.remove(id, req.user.id);
  }
}
