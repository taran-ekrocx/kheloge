import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus, FeeFrequency } from '@kheloge/database';

export const INVOICES_QUEUE = 'invoices';

export const JOB_AUTO_GENERATE = 'auto-generate';
export const JOB_MARK_OVERDUE = 'mark-overdue';

@Processor(INVOICES_QUEUE)
export class InvoicesProcessor {
  private readonly logger = new Logger('InvoicesProcessor');

  constructor(private prisma: PrismaService) {}

  /**
   * Auto-generate monthly/quarterly/etc. invoices for all active enrollments
   * whose fee plan due date matches today.
   */
  @Process(JOB_AUTO_GENERATE)
  async handleAutoGenerate(job: Job<{ venueId?: string }>) {
    this.logger.log(`Running auto-generate invoices job (venueId=${job.data.venueId ?? 'all'})`);

    const today = new Date();
    const dueDay = today.getDate();

    // Find all active fee plans whose dueDay matches today's date
    const feePlans = await this.prisma.feePlan.findMany({
      where: {
        isActive: true,
        dueDay,
        ...(job.data.venueId
          ? { batch: { venueId: job.data.venueId } }
          : {}),
      },
      include: {
        batch: {
          include: {
            enrollments: { where: { isActive: true }, select: { studentId: true } },
          },
        },
      },
    });

    let created = 0;

    for (const plan of feePlans) {
      const dueDate = new Date(today.getFullYear(), today.getMonth(), plan.dueDay);

      // Determine billing period suffix
      const suffix = this.periodSuffix(plan.frequency, today);

      for (const enrollment of plan.batch?.enrollments ?? []) {
        // Skip if an invoice for this plan+student already exists this period
        const existing = await this.prisma.invoice.findFirst({
          where: {
            studentId: enrollment.studentId,
            feePlanId: plan.id,
            dueDate: { gte: new Date(dueDate.getFullYear(), dueDate.getMonth(), 1) },
          },
        });
        if (existing) continue;

        await this.prisma.invoice.create({
          data: {
            studentId: enrollment.studentId,
            feePlanId: plan.id,
            amount: plan.amount,
            dueDate,
            invoiceNumber: `INV-${enrollment.studentId.slice(-4).toUpperCase()}-${suffix}`,
            status: PaymentStatus.PENDING,
          },
        });
        created++;
      }
    }

    this.logger.log(`Auto-generated ${created} invoices`);
    return { created };
  }

  /**
   * Mark all PENDING invoices whose due date has passed as OVERDUE.
   */
  @Process(JOB_MARK_OVERDUE)
  async handleMarkOverdue(job: Job) {
    this.logger.log('Running mark-overdue invoices job');

    const now = new Date();
    const result = await this.prisma.invoice.updateMany({
      where: {
        status: PaymentStatus.PENDING,
        dueDate: { lt: now },
      },
      data: { status: PaymentStatus.OVERDUE },
    });

    this.logger.log(`Marked ${result.count} invoices as overdue`);
    return { marked: result.count };
  }

  private periodSuffix(frequency: FeeFrequency, date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const q = Math.ceil((date.getMonth() + 1) / 3);

    switch (frequency) {
      case FeeFrequency.MONTHLY:
        return `${y}${m}`;
      case FeeFrequency.QUARTERLY:
        return `${y}Q${q}`;
      case FeeFrequency.HALF_YEARLY:
        return `${y}H${date.getMonth() < 6 ? 1 : 2}`;
      case FeeFrequency.ANNUAL:
        return `${y}`;
      default:
        return `${y}${m}`;
    }
  }
}
