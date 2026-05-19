import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TagService } from './tag.service';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('api/tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Public()
  @Get()
  findAll() {
    return this.tagService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() body: { name: string }) {
    return this.tagService.create(body.name);
  }
}
