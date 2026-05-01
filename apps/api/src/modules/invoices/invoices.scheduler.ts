import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { INVOICES_QUEUE, JOB_AUTO_GENERATE, JOB_MARK_OVERDUE } from './invoices.processor';

/**
 * Registers recurring Bull jobs on startup.
 * - auto-generate: runs daily at midnight (via cron)
 * - mark-overdue:  runs daily at 00:05 (via cron)
 *
 * Bull deduplicates repeat jobs by key, so restarting the server
 * does not create duplicate cron entries.
 */
@Injectable()
export class InvoicesScheduler implements OnModuleInit {
  private readonly logger = new Logger('InvoicesScheduler');

  constructor(@InjectQueue(INVOICES_QUEUE) private invoicesQueue: Queue) {}

  async onModuleInit() {
    await this.invoicesQueue.add(
      JOB_AUTO_GENERATE,
      {},
      {
        repeat: { cron: '0 0 * * *' }, // midnight daily
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    await this.invoicesQueue.add(
      JOB_MARK_OVERDUE,
      {},
      {
        repeat: { cron: '5 0 * * *' }, // 00:05 daily
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    this.logger.log('Invoice cron jobs registered');
  }
}
