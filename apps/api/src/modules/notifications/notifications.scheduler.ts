import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NOTIFICATIONS_QUEUE, JOB_FEE_REMINDERS, JOB_LEAD_FOLLOWUPS } from './notifications.processor';

@Injectable()
export class NotificationsScheduler implements OnModuleInit {
  private readonly logger = new Logger('NotificationsScheduler');

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private notificationsQueue: Queue) {}

  async onModuleInit() {
    // Fee reminders: run daily at 9:00 AM
    await this.notificationsQueue.add(
      JOB_FEE_REMINDERS,
      {},
      {
        repeat: { cron: '0 9 * * *' },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    // Lead follow-up: run daily at 10:00 AM
    await this.notificationsQueue.add(
      JOB_LEAD_FOLLOWUPS,
      {},
      {
        repeat: { cron: '0 10 * * *' },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    this.logger.log('Notification cron jobs registered (fee-reminders @ 9am, lead-followups @ 10am)');
  }
}
