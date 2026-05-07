import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus } from '@kheloge/database';

export const INVOICES_QUEUE = 'invoices';

export const JOB_AUTO_GENERATE = 'auto-generate';
export const JOB_MARK_OVERDUE = 'mark-overdue';

@Processor(INVOICES_QUEUE)
export class InvoicesProcessor {
  private readonly logger = new Logger('InvoicesProcessor');

  constructor(private prisma: PrismaService) {}

  /**
   * Auto-generate monthly invoices for all active enrollments whose batch
   * feeDueDay matches today.
   */
  @Process(JOB_AUTO_GENERATE)
  async handleAutoGenerate(job: Job<{ venueId?: string }>) {
    this.logger.log(`Running auto-generate invoices job (venueId=${job.data.venueId ?? 'all'})`);

    const today = new Date();
    const dueDay = today.getDate();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    const batches = await this.prisma.batch.findMany({
      where: {
        fee: { not: null },
        feeDueDay: dueDay,
        isActive: true,
        ...(job.data.venueId ? { venueId: job.data.venueId } : {}),
      },
      include: {
        enrollments: { where: { isActive: true }, select: { studentId: true } },
      },
    });

    let created = 0;

    for (const batch of batches) {
      const dueDate = new Date(y, today.getMonth(), dueDay);

      for (const enrollment of batch.enrollments) {
        const existing = await this.prisma.invoice.findFirst({
          where: {
            studentId: enrollment.studentId,
            batchId: batch.id,
            dueDate: { gte: new Date(y, today.getMonth(), 1) },
          },
        });
        if (existing) continue;

        await this.prisma.invoice.create({
          data: {
            studentId: enrollment.studentId,
            batchId: batch.id,
            amount: batch.fee!,
            dueDate,
            invoiceNumber: `INV-${enrollment.studentId.slice(-4).toUpperCase()}-${y}${m}`,
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
}
