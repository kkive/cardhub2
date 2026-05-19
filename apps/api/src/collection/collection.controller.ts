import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Request, Res, UseGuards } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/create-collection.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtOptionalGuard } from '../auth/jwt-optional.guard';
import { Response } from 'express';

@Controller('api/collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateCollectionDto, @Request() req: { user: { id: string } }) {
    return this.collectionService.create(dto, req.user.id);
  }

  @Public()
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('sort') sort?: string,
  ) {
    return this.collectionService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      q,
      priceMin ? parseInt(priceMin, 10) : undefined,
      priceMax ? parseInt(priceMax, 10) : undefined,
      sort,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('admin/list')
  adminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    return this.collectionService.adminFindAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
      status,
    });
  }

  // Static route MUST come before :id to avoid matching "exports" as an id
  @Public()
  @UseGuards(JwtOptionalGuard)
  @Get('exports/:exportId/download')
  async downloadExport(
    @Param('exportId') exportId: string,
    @Request() req: any,
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || devUserId || undefined;
    const { stream, exportRecord } = await this.collectionService.downloadExport(exportId, userId);
    await this.collectionService.incrementDownloadCount(exportRecord.collectionId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="collection-${exportRecord.collectionId}-${exportRecord.format}.zip"`,
      'Content-Length': exportRecord.sizeBytes.toString(),
    });
    stream.pipe(res);
  }

  @Public()
  @UseGuards(JwtOptionalGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user?.role === 'admin';
    return this.collectionService.findOne(id, isAdmin);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collectionService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.collectionService.publish(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.collectionService.unpublish(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collectionService.remove(id);
  }

  @Public()
  @UseGuards(JwtOptionalGuard)
  @Post(':id/export')
  async exportCollection(
    @Param('id') id: string,
    @Body('format') format: string,
    @Request() req: any,
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
  ) {
    const userId = req.user?.id || devUserId || undefined;
    return this.collectionService.exportCollection(
      id,
      (format as any) ?? 'platform_json',
      userId,
    );
  }
}
