import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PaymentsController } from './payments.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { DashboardController } from './dashboard.controller';
import { PaymentsService } from './payments.service';
import { ReceiptService } from './receipt.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { NOTIFICATIONS_QUEUE } from '../notifications/notifications.processor';

@Module({
  imports: [InvoicesModule, BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [PaymentsController, RazorpayWebhookController, DashboardController],
  providers: [PaymentsService, ReceiptService],
  exports: [PaymentsService, ReceiptService],
})
export class PaymentsModule {}
