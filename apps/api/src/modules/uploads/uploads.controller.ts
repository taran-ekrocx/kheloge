import {
  Controller,
  Post,
  Param,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MultipartRequest } from '../../common/types/multipart-request';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileUploadService, UploadFolder } from './file-upload.service';

const VALID_FOLDERS: UploadFolder[] = ['photos', 'id-cards', 'invoices'];

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('uploads')
export class UploadsController {
  constructor(private readonly fileUpload: FileUploadService) {}

  /**
   * POST /uploads/:folder
   * Multipart upload for student photos (photos/), ID card PDFs (id-cards/), invoice PDFs (invoices/).
   * Returns { url } with the public URL of the stored file.
   */
  @Post(':folder')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'File to upload', schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async uploadFile(
    @Param('folder') folder: string,
    @Req() req: MultipartRequest,
  ): Promise<{ url: string }> {
    if (!VALID_FOLDERS.includes(folder as UploadFolder)) {
      throw new BadRequestException(`Invalid folder "${folder}". Valid folders: ${VALID_FOLDERS.join(', ')}`);
    }

    if (!req.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No file provided');
    }

    const ext = extname(data.filename) || this.mimeToExt(data.mimetype);
    const fileName = `${uuidv4()}${ext}`;

    const url = await this.fileUpload.uploadStream(
      folder as UploadFolder,
      fileName,
      data.file,
      data.mimetype,
    );

    return { url };
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return map[mime] ?? '';
  }
}
