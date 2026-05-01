import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InvoicesProcessor, INVOICES_QUEUE } from './invoices.processor';
import { InvoicesScheduler } from './invoices.scheduler';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesHttpService } from './invoices-http.service';
import { DatabaseModule } from '../../database/database.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: INVOICES_QUEUE }),
    DatabaseModule,
    UploadsModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesProcessor, InvoicesScheduler, InvoicePdfService, InvoicesHttpService],
  exports: [BullModule, InvoicePdfService],
})
export class InvoicesModule {}
