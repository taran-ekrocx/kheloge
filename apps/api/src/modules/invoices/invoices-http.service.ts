import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMode, PaymentStatus } from '@kheloge/database';
import { PrismaService } from '../../database/prisma.service';

export interface InvoiceListFilters {
  status?: PaymentStatus;
  studentId?: string;
  batchId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class InvoicesHttpService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, filters: InvoiceListFilters = {}) {
    const where: any = {
      student: { organizationId },
    };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.studentId) {
      where.studentId = filters.studentId;
    }
    if (filters.batchId) {
      where.feePlan = { batchId: filters.batchId };
    }
    if (filters.from || filters.to) {
      where.dueDate = {};
      if (filters.from) where.dueDate.gte = new Date(filters.from);
      if (filters.to) where.dueDate.lte = new Date(filters.to);
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, phone: true } },
        feePlan: { select: { id: true, name: true, frequency: true, batch: { select: { id: true, name: true, sport: { select: { name: true } } } } } },
        payments: { select: { id: true, amount: true, paidAt: true, mode: true } },
      },
      orderBy: { dueDate: 'desc' },
      take: 500,
    });
  }

  async markPaid(organizationId: string, invoiceId: string, mode: PaymentMode = PaymentMode.CASH) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, student: { organizationId } },
      include: { student: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const receiptNumber = `RCP-${Date.now()}`;
    const payment = await this.prisma.payment.create({
      data: {
        studentId: invoice.studentId,
        invoiceId,
        amount: invoice.amount,
        mode,
        receiptNumber,
        paidAt: new Date(),
        status: PaymentStatus.PAID,
      },
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: PaymentStatus.PAID },
    });

    return payment;
  }
}
