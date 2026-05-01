import { Module } from '@nestjs/common';
import { EnquiriesController } from './enquiries.controller';
import { GlobalEnquiriesController } from './global-enquiries.controller';
import { EnquiriesService } from './enquiries.service';

@Module({
  controllers: [EnquiriesController, GlobalEnquiriesController],
  providers: [EnquiriesService],
  exports: [EnquiriesService],
})
export class EnquiriesModule {}
