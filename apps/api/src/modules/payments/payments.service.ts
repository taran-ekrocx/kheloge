import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { PaymentMode, PaymentStatus, FeeFrequency } from '@kheloge/database';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { NOTIFICATIONS_QUEUE, JOB_FEE_REMINDERS } from '../notifications/notifications.processor';

export interface RecordPaymentDto {
  studentId: string;
  invoiceId?: string;
  amount: number;
  mode: PaymentMode;
  referenceNumber?: string;
  notes?: string;
}

export interface CreateInvoiceDto {
  studentId: string;
  feePlanId: string;
  dueDate: string;
  amount?: number; // override fee plan amount
}

export interface CreateFeePlanDto {
  batchId?: string;
  name: string;
  amount: number;
  frequency: FeeFrequency;
  dueDay?: number;
  lateFeeAmount?: number;
  discountAmount?: number;
}

export interface UpdateFeePlanDto {
  name?: string;
  amount?: number;
  frequency?: FeeFrequency;
  dueDay?: number;
  lateFeeAmount?: number;
  discountAmount?: number;
  isActive?: boolean;
}

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private notificationsQueue: Queue,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get('RAZORPAY_KEY_ID') || '',
      key_secret: this.config.get('RAZORPAY_KEY_SECRET') || '',
    });
  }

  async getStudentInvoices(studentId: string) {
    return this.prisma.invoice.findMany({
      where: { studentId },
      include: { feePlan: true, payments: true },
      orderBy: { dueDate: 'desc' },
    });
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const feePlan = await this.prisma.feePlan.findUniqueOrThrow({ where: { id: dto.feePlanId } });
    const invoiceNumber = `INV-${Date.now()}`;
    return this.prisma.invoice.create({
      data: {
        studentId: dto.studentId,
        feePlanId: dto.feePlanId,
        amount: dto.amount ?? feePlan.amount,
        dueDate: new Date(dto.dueDate),
        invoiceNumber,
      },
    });
  }

  async recordPayment(dto: RecordPaymentDto) {
    const receiptNumber = `RCP-${Date.now()}`;
    const payment = await this.prisma.payment.create({
      data: {
        studentId: dto.studentId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        mode: dto.mode,
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
        receiptNumber,
        paidAt: new Date(),
        status: PaymentStatus.PAID,
      },
    });

    // Update invoice status if linked
    if (dto.invoiceId) {
      await this.prisma.invoice.update({
        where: { id: dto.invoiceId },
        data: { status: PaymentStatus.PAID },
      });
    }

    return payment;
  }

  async createRazorpayOrder(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { student: true },
    });

    const order = await this.razorpay.orders.create({
      amount: Number(invoice.amount) * 100, // paise
      currency: 'INR',
      receipt: invoice.invoiceNumber,
      notes: { studentId: invoice.studentId, invoiceId },
    });

    return { orderId: order.id, amount: order.amount, currency: order.currency };
  }

  async verifyRazorpayPayment(
    invoiceId: string,
    orderId: string,
    paymentId: string,
    signature: string,
  ) {
    const secret = this.config.get('RAZORPAY_KEY_SECRET') || '';
    const body = `${orderId}|${paymentId}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expectedSig !== signature) throw new BadRequestException('Invalid payment signature');

    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    return this.recordPayment({
      studentId: invoice.studentId,
      invoiceId,
      amount: Number(invoice.amount),
      mode: PaymentMode.ONLINE,
      referenceNumber: paymentId,
      notes: `Razorpay order: ${orderId}`,
    });
  }

  async findPaymentByReference(referenceNumber: string) {
    return this.prisma.payment.findFirst({
      where: { referenceNumber },
      select: { id: true },
    });
  }

  async getDashboard(venueId: string) {
    const venueStudentFilter = { enrollments: { some: { batch: { venueId } } } };
    const [students, payments, overdueInvoices] = await Promise.all([
      this.prisma.student.findMany({ where: venueStudentFilter, select: { id: true } }),
      this.prisma.payment.findMany({
        where: { student: venueStudentFilter, paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        select: { amount: true },
      }),
      this.prisma.invoice.findMany({
        where: { student: venueStudentFilter, status: PaymentStatus.OVERDUE },
        select: { amount: true },
      }),
    ]);

    const collected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const overdue = overdueInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

    return { collected, overdue, totalStudents: students.length };
  }

  // ── Fee Plan CRUD ─────────────────────────────────────────────────────────

  async getVenueFeePlans(venueId: string) {
    const batches = await this.prisma.batch.findMany({
      where: { venueId },
      select: {
        id: true,
        name: true,
        sport: { select: { name: true } },
        feePlans: true,
        _count: { select: { enrollments: { where: { isActive: true } } } },
      },
    });

    return batches.flatMap((b) =>
      b.feePlans.map((fp) => ({
        ...fp,
        batchName: b.name,
        sportName: b.sport.name,
        activeStudents: b._count.enrollments,
      })),
    );
  }

  async createFeePlan(venueId: string, dto: CreateFeePlanDto) {
    // Verify batch belongs to venue when batchId is provided
    if (dto.batchId) {
      await this.prisma.batch.findFirstOrThrow({ where: { id: dto.batchId, venueId } });
    }
    return this.prisma.feePlan.create({ data: { ...dto } });
  }

  async updateFeePlan(feePlanId: string, dto: UpdateFeePlanDto) {
    return this.prisma.feePlan.update({ where: { id: feePlanId }, data: { ...dto } });
  }

  // ── Venue Invoices ────────────────────────────────────────────────────────

  async getVenueInvoices(venueId: string) {
    return this.prisma.invoice.findMany({
      where: { student: { enrollments: { some: { batch: { venueId } } } } },
      include: {
        student: { select: { id: true, name: true, phone: true } },
        feePlan: { select: { name: true, frequency: true } },
        payments: { select: { id: true, amount: true, paidAt: true, mode: true } },
      },
      orderBy: { dueDate: 'desc' },
      take: 200,
    });
  }

  async markInvoicePaid(invoiceId: string, mode: PaymentMode = PaymentMode.CASH) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { student: true },
    });
    return this.recordPayment({
      studentId: invoice.studentId,
      invoiceId,
      amount: Number(invoice.amount),
      mode,
    });
  }

  // ── Org-level KPI Dashboard ───────────────────────────────────────────────

  async getOrgKpis(organizationId: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [totalStudents, activeStudents, activeBatches, monthlyPayments, pendingInvoices, overdueInvoices, recentEnrollments, recentPayments] =
      await Promise.all([
        this.prisma.student.count({ where: { organizationId } }),
        this.prisma.student.count({ where: { organizationId, status: 'ACTIVE' } }),
        this.prisma.batch.count({ where: { venue: { organizationId }, isActive: true } }),
        this.prisma.payment.findMany({
          where: { student: { organizationId }, paidAt: { gte: monthStart } },
          select: { amount: true },
        }),
        this.prisma.invoice.findMany({
          where: { student: { organizationId }, status: PaymentStatus.PENDING },
          select: { amount: true },
        }),
        this.prisma.invoice.findMany({
          where: { student: { organizationId }, status: PaymentStatus.OVERDUE },
          select: { amount: true },
        }),
        this.prisma.enrollment.findMany({
          where: { student: { organizationId } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            student: { select: { name: true } },
            batch: { select: { name: true, sport: { select: { name: true } } } },
          },
        }),
        this.prisma.payment.findMany({
          where: { student: { organizationId } },
          orderBy: { paidAt: 'desc' },
          take: 10,
          include: { student: { select: { name: true } } },
        }),
      ]);

    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingFeesAmount = pendingInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const overdueCount = overdueInvoices.length;

    return {
      totalStudents,
      activeStudents,
      activeBatches,
      monthlyRevenue,
      pendingFeesAmount,
      overdueCount,
      recentEnrolments: recentEnrollments.map((e) => ({
        id: e.id,
        studentName: e.student.name,
        batchName: e.batch.name,
        sportName: e.batch.sport.name,
        createdAt: e.createdAt,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        studentName: p.student.name,
        amount: Number(p.amount),
        mode: p.mode,
        paidAt: p.paidAt,
      })),
    };
  }

  // ── Fee Reminders ─────────────────────────────────────────────────────────

  async dispatchFeeReminders(venueId: string) {
    const job = await this.notificationsQueue.add(JOB_FEE_REMINDERS, { venueId }, { removeOnComplete: 10 });
    return { jobId: job.id, queued: true };
  }

  // ── Enhanced KPI Dashboard ────────────────────────────────────────────────

  async getKpiDashboard(venueId: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const venueStudentFilter = { enrollments: { some: { batch: { venueId } } } };

    const [students, activeBatches, monthlyPayments, pendingInvoices, recentEnrollments, recentPayments] =
      await Promise.all([
        this.prisma.student.count({ where: { ...venueStudentFilter, status: 'ACTIVE' } }),
        this.prisma.batch.count({ where: { venueId, isActive: true } }),
        this.prisma.payment.findMany({
          where: { student: venueStudentFilter, paidAt: { gte: monthStart } },
          select: { amount: true },
        }),
        this.prisma.invoice.findMany({
          where: { student: venueStudentFilter, status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] } },
          select: { amount: true },
        }),
        this.prisma.enrollment.findMany({
          where: { batch: { venueId } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            student: { select: { name: true } },
            batch: { select: { name: true, sport: { select: { name: true } } } },
          },
        }),
        this.prisma.payment.findMany({
          where: { student: venueStudentFilter },
          orderBy: { paidAt: 'desc' },
          take: 10,
          include: { student: { select: { name: true } } },
        }),
      ]);

    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingFees = pendingInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

    return {
      totalStudents: students,
      activeBatches,
      monthlyRevenue,
      pendingFees,
      recentEnrollments: recentEnrollments.map((e) => ({
        id: e.id,
        studentName: e.student.name,
        batchName: e.batch.name,
        sportName: e.batch.sport.name,
        createdAt: e.createdAt,
        type: 'enrollment' as const,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        studentName: p.student.name,
        amount: Number(p.amount),
        mode: p.mode,
        paidAt: p.paidAt,
        type: 'payment' as const,
      })),
    };
  }

  async getGlobalKpiDashboard(orgId: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const studentOrgFilter = { organizationId: orgId };

    const [students, activeBatches, monthlyPayments, pendingInvoices, recentEnrollments, recentPayments] =
      await Promise.all([
        this.prisma.student.count({ where: { ...studentOrgFilter, status: 'ACTIVE' } }),
        this.prisma.batch.count({ where: { venue: { organizationId: orgId }, isActive: true } }),
        this.prisma.payment.findMany({
          where: { student: studentOrgFilter, paidAt: { gte: monthStart } },
          select: { amount: true },
        }),
        this.prisma.invoice.findMany({
          where: { student: studentOrgFilter, status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] } },
          select: { amount: true },
        }),
        this.prisma.enrollment.findMany({
          where: { student: studentOrgFilter },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            student: { select: { name: true } },
            batch: { select: { name: true, sport: { select: { name: true } } } },
          },
        }),
        this.prisma.payment.findMany({
          where: { student: studentOrgFilter },
          orderBy: { paidAt: 'desc' },
          take: 10,
          include: { student: { select: { name: true } } },
        }),
      ]);

    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingFees = pendingInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

    return {
      totalStudents: students,
      activeBatches,
      monthlyRevenue,
      pendingFees,
      recentEnrollments: recentEnrollments.map((e) => ({
        id: e.id,
        studentName: e.student.name,
        batchName: e.batch.name,
        sportName: e.batch.sport.name,
        createdAt: e.createdAt,
        type: 'enrollment' as const,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        studentName: p.student.name,
        amount: Number(p.amount),
        mode: p.mode,
        paidAt: p.paidAt,
        type: 'payment' as const,
      })),
    };
  }

  async getGlobalPaymentsDashboard(orgId: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [students, payments, overdueInvoices] = await Promise.all([
      this.prisma.student.count({ where: { organizationId: orgId } }),
      this.prisma.payment.findMany({
        where: { student: { organizationId: orgId }, paidAt: { gte: monthStart } },
        select: { amount: true },
      }),
      this.prisma.invoice.findMany({
        where: { student: { organizationId: orgId }, status: PaymentStatus.OVERDUE },
        select: { amount: true },
      }),
    ]);
    const collected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const overdue = overdueInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
    return { collected, overdue, totalStudents: students };
  }

  async getOrgFeePlans(orgId: string) {
    const batches = await this.prisma.batch.findMany({
      where: { venue: { organizationId: orgId } },
      select: {
        id: true,
        name: true,
        sport: { select: { name: true } },
        feePlans: true,
        _count: { select: { enrollments: { where: { isActive: true } } } },
      },
    });
    return batches.flatMap((b) =>
      b.feePlans.map((fp) => ({
        ...fp,
        batchName: b.name,
        sportName: b.sport.name,
        activeStudents: b._count.enrollments,
      })),
    );
  }

  async getOrgInvoices(orgId: string) {
    return this.prisma.invoice.findMany({
      where: { student: { organizationId: orgId } },
      include: {
        student: { select: { id: true, name: true, phone: true } },
        feePlan: { select: { name: true, frequency: true } },
        payments: { select: { id: true, amount: true, paidAt: true, mode: true } },
      },
      orderBy: { dueDate: 'desc' },
      take: 200,
    });
  }
}
