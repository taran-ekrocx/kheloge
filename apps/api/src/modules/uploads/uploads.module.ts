import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { UploadsController } from './uploads.controller';

@Module({
  controllers: [UploadsController],
  providers: [FileUploadService],
  exports: [FileUploadService],
})
export class UploadsModule {}
