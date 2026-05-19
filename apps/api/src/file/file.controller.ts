import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtOptionalGuard } from '../auth/jwt-optional.guard';

@Controller('api/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('cardId') cardId: string,
    @Body('visibility') visibility?: string,
  ) {
    return this.fileService.upload(cardId, file, visibility as 'public' | 'paid' | undefined);
  }

  @Public()
  @UseGuards(JwtOptionalGuard)
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Request() req: any,
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || devUserId || undefined;
    const { stream, fileAsset } = await this.fileService.download(id, userId);
    res.set({
      'Content-Type': fileAsset.mimeType,
      'Content-Disposition': `attachment; filename="${fileAsset.filename}"`,
      'Content-Length': fileAsset.sizeBytes.toString(),
    });
    stream.pipe(res);
  }

  @Public()
  @UseGuards(JwtOptionalGuard)
  @Post(':cardId/export')
  async exportCard(
    @Param('cardId') cardId: string,
    @Body('format') format: string,
    @Request() req: any,
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
  ) {
    const userId = req.user?.id || devUserId || undefined;
    return this.fileService.exportCard(cardId, (format as any) ?? 'platform_json', userId);
  }

  @Public()
  @UseGuards(JwtOptionalGuard)
  @Get('exports/:id/download')
  async downloadExport(
    @Param('id') id: string,
    @Request() req: any,
    @Headers('X-Dev-User-Id') devUserId: string | undefined,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || devUserId || undefined;
    const { stream, exportRecord } = await this.fileService.downloadExport(id, userId);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${exportRecord.cardId}-${exportRecord.format}.json"`,
    });
    stream.pipe(res);
  }
}
