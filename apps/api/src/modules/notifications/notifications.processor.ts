import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus, EnquiryStage } from '@kheloge/database';

export const NOTIFICATIONS_QUEUE = 'notifications';

export const JOB_FEE_REMINDERS = 'fee-reminders';
export const JOB_LEAD_FOLLOWUPS = 'lead-followups';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor {
  private readonly logger = new Logger('NotificationsProcessor');

  constructor(private prisma: PrismaService) {}

  /**
   * Fee reminder: finds all PENDING invoices due in exactly 7 days (first reminder)
   * or within 3 days (urgent reminder) and queues notifications.
   * In production, integrate MSG91/WhatsApp here.
   */
  @Process(JOB_FEE_REMINDERS)
  async handleFeeReminders(job: Job) {
    this.logger.log('Running fee reminders job');

    const now = new Date();

    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    const in7DaysEnd = new Date(now);
    in7DaysEnd.setDate(in7DaysEnd.getDate() + 8); // exclusive upper bound for 7-day window

    // Find invoices due within 3 days (urgent) OR in the 7-day window (first reminder)
    const upcoming = await this.prisma.invoice.findMany({
      where: {
        status: PaymentStatus.PENDING,
        dueDate: { lte: in7DaysEnd, gte: now },
      },
      include: {
        student: {
          include: { guardians: { where: { isPrimary: true } } },
        },
      },
    });

    let sent = 0;
    for (const invoice of upcoming) {
      const phone = invoice.student.guardians[0]?.phone || invoice.student.phone;
      if (!phone) continue;

      const daysUntilDue = Math.ceil(
        (invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const urgency = daysUntilDue <= 3 ? 'URGENT' : '7-DAY';
      const msg = `Dear Parent, fee of ₹${invoice.amount} for ${invoice.student.name} is due on ${invoice.dueDate.toDateString()}. Invoice: ${invoice.invoiceNumber}`;
      this.logger.log(`[FEE REMINDER ${urgency}] → ${phone}: ${msg}`);
      // TODO: integrate MSG91 / WhatsApp API here
      sent++;
    }

    this.logger.log(`Fee reminders: ${sent} sent, ${upcoming.length - sent} skipped (no phone)`);
    return { sent };
  }

  /**
   * Lead follow-up: finds enquiries with a followUpAt in the past that haven't been
   * updated in the last 24h and logs them for follow-up.
   */
  @Process(JOB_LEAD_FOLLOWUPS)
  async handleLeadFollowups(job: Job) {
    this.logger.log('Running lead follow-up job');

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const overdue = await this.prisma.enquiry.findMany({
      where: {
        stage: {
          notIn: [EnquiryStage.CONVERTED, EnquiryStage.LOST],
        },
        followUpAt: { lte: now },
        updatedAt: { lte: yesterday },
      },
      include: {
        venue: { select: { name: true } },
      },
      take: 100,
    });

    for (const enquiry of overdue) {
      this.logger.log(
        `[LEAD FOLLOW-UP] ${enquiry.venue.name} — ${enquiry.name} (${enquiry.phone}) stage=${enquiry.stage}, followUpAt=${enquiry.followUpAt?.toDateString()}`,
      );
      // TODO: send WhatsApp/SMS notification to venue manager
    }

    this.logger.log(`Lead follow-ups: ${overdue.length} overdue`);
    return { overdue: overdue.length };
  }
}
