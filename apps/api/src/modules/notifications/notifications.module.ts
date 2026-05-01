import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsProcessor, NOTIFICATIONS_QUEUE } from './notifications.processor';
import { NotificationsScheduler } from './notifications.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  providers: [NotificationsProcessor, NotificationsScheduler],
})
export class NotificationsModule {}
