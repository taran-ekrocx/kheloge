import { Injectable, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceStatus } from '@kheloge/database';
import { AttendanceGateway } from './attendance.gateway';

export interface MarkAttendanceDto {
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
  date?: string; // ISO date string, defaults to today
}

export interface QrCheckinDto {
  studentId: string;
  batchId: string;
}

export interface StartSessionDto {
  batchId: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AttendanceGateway))
    private gateway: AttendanceGateway,
  ) {}

  async getForBatch(batchId: string, date: string) {
    const targetDate = new Date(date);
    return this.prisma.attendance.findMany({
      where: { batchId, date: targetDate },
      include: { student: { select: { id: true, name: true, photoUrl: true } } },
    });
  }

  async getForStudent(studentId: string, startDate: string, endDate: string) {
    return this.prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      include: { batch: { include: { sport: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async mark(batchId: string, dto: MarkAttendanceDto, markedById: string) {
    const date = dto.date ? new Date(dto.date) : new Date();
    date.setHours(0, 0, 0, 0);

    const ops = dto.records.map((r) =>
      this.prisma.attendance.upsert({
        where: { batchId_studentId_date: { batchId, studentId: r.studentId, date } },
        create: { batchId, studentId: r.studentId, date, status: r.status, markedById, notes: r.notes },
        update: { status: r.status, notes: r.notes, markedById },
      }),
    );

    const results = await this.prisma.$transaction(ops);

    // Emit real-time update to all clients watching this batch
    this.gateway.emitAttendanceUpdate(batchId, {
      date: date.toISOString().split('T')[0],
      records: results.map((r) => ({ studentId: r.studentId, status: r.status })),
    });

    return results;
  }

  async qrCheckin(dto: QrCheckinDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendance.upsert({
      where: {
        batchId_studentId_date: { batchId: dto.batchId, studentId: dto.studentId, date: today },
      },
      create: {
        batchId: dto.batchId,
        studentId: dto.studentId,
        date: today,
        status: AttendanceStatus.PRESENT,
        checkInAt: new Date(),
      },
      update: { status: AttendanceStatus.PRESENT, checkInAt: new Date() },
    });

    // Emit real-time QR check-in event
    this.gateway.emitQrCheckin(dto.batchId, {
      studentId: dto.studentId,
      status: AttendanceStatus.PRESENT,
      checkInAt: record.checkInAt?.toISOString() || new Date().toISOString(),
    });

    return record;
  }

  async autoMarkAbsent(batchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all enrolled students
    const enrollments = await this.prisma.enrollment.findMany({
      where: { batchId, isActive: true },
      select: { studentId: true },
    });

    // For each student without today's record, create absent
    const ops = enrollments.map((e) =>
      this.prisma.attendance.upsert({
        where: { batchId_studentId_date: { batchId, studentId: e.studentId, date: today } },
        create: {
          batchId, studentId: e.studentId, date: today,
          status: AttendanceStatus.ABSENT, isAutoMarked: true,
        },
        update: {}, // don't overwrite manually marked records
      }),
    );

    return this.prisma.$transaction(ops);
  }

  async getStudentStats(studentId: string, months: number = 3) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const records = await this.prisma.attendance.findMany({
      where: { studentId, date: { gte: since } },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    return { total, present, absent: total - present, percentage: total ? Math.round((present / total) * 100) : 0 };
  }

  async verifyCoachBatch(coachId: string, batchId: string): Promise<boolean> {
    const bc = await this.prisma.batchCoach.findUnique({
      where: { batchId_coachId: { batchId, coachId } },
    });
    return !!bc;
  }

  async startSession(batchId: string, coachId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await this.prisma.attendanceSession.create({
      data: { batchId, coachId, date: today },
      include: {
        batch: {
          include: {
            sport: { select: { id: true, name: true } },
            enrollments: {
              where: { isActive: true },
              include: {
                student: { select: { id: true, name: true, photoUrl: true, phone: true } },
              },
            },
          },
        },
        coach: { select: { id: true, name: true } },
      },
    });

    return session;
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        batch: {
          include: {
            sport: { select: { id: true, name: true } },
            enrollments: {
              where: { isActive: true },
              include: {
                student: { select: { id: true, name: true, photoUrl: true, phone: true } },
              },
            },
          },
        },
        coach: { select: { id: true, name: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async endSession(sessionId: string) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  async getSessionsForBatch(batchId: string, date?: string) {
    const where: any = { batchId };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      where.date = d;
    }
    return this.prisma.attendanceSession.findMany({
      where,
      include: { coach: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }
}
