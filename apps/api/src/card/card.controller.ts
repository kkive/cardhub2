import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { CardService } from './card.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SearchCardDto } from './dto/search-card.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtOptionalGuard } from '../auth/jwt-optional.guard';

@Controller('api/cards')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateCardDto, @Request() req: { user: { id: string } }) {
    return this.cardService.create(dto, req.user.id);
  }

  @Public()
  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.cardService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Public()
  @Get('search')
  search(@Query() dto: SearchCardDto) {
    return this.cardService.search(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('admin/list')
  adminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('cardType') cardType?: string,
  ) {
    return this.cardService.adminFindAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
      status,
      cardType,
    });
  }

  @Public()
  @UseGuards(JwtOptionalGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user?.role === 'admin';
    return this.cardService.findOne(id, isAdmin);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.cardService.update(id, dto, req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.cardService.remove(id, req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.cardService.publish(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.cardService.unpublish(id);
  }
}
