import { Injectable, Inject, forwardRef, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceStatus, CoachAttendanceStatus, UserRole } from '@kheloge/database';
import { AttendanceGateway } from './attendance.gateway';

export interface MarkAttendanceDto {
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
  date?: string; // ISO date string, defaults to today
  sessionId?: string;
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
    const date = dto.date
      ? new Date(dto.date)
      : (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; })();

    const endedSession = await this.prisma.attendanceSession.findFirst({
      where: { batchId, date, endedAt: { not: null } },
    });
    if (endedSession) {
      throw new ForbiddenException('Session has ended. Attendance can no longer be modified.');
    }

    // Resolve sessionId: use provided or look up active session for linking
    let sessionId = dto.sessionId ?? null;
    if (!sessionId) {
      const activeSession = await this.prisma.attendanceSession.findFirst({
        where: { batchId, date, endedAt: null },
        select: { id: true },
      });
      sessionId = activeSession?.id ?? null;
    }

    const ops = dto.records.map((r) =>
      this.prisma.attendance.upsert({
        where: { batchId_studentId_date: { batchId, studentId: r.studentId, date } },
        create: { batchId, studentId: r.studentId, date, status: r.status, markedById, notes: r.notes, sessionId },
        update: { status: r.status, notes: r.notes, markedById, sessionId: sessionId ?? undefined },
      }),
    );

    const results = await this.prisma.$transaction(ops);

    this.gateway.emitAttendanceUpdate(batchId, {
      date: date.toISOString().split('T')[0],
      records: results.map((r) => ({ studentId: r.studentId, status: r.status })),
    });

    return results;
  }

  async qrCheckin(dto: QrCheckinDto) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

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

    this.gateway.emitQrCheckin(dto.batchId, {
      studentId: dto.studentId,
      status: AttendanceStatus.PRESENT,
      checkInAt: record.checkInAt?.toISOString() || new Date().toISOString(),
    });

    return record;
  }

  async autoMarkAbsent(batchId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { batchId, isActive: true },
      select: { studentId: true },
    });

    const ops = enrollments.map((e) =>
      this.prisma.attendance.upsert({
        where: { batchId_studentId_date: { batchId, studentId: e.studentId, date: today } },
        create: {
          batchId, studentId: e.studentId, date: today,
          status: AttendanceStatus.ABSENT, isAutoMarked: true,
        },
        update: {},
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
    today.setUTCHours(0, 0, 0, 0);

    // Enforce: one session per batch per day (active or already completed)
    const existingBatchSession = await this.prisma.attendanceSession.findFirst({
      where: { batchId, date: today },
    });
    if (existingBatchSession) {
      if (!existingBatchSession.endedAt) {
        throw new ConflictException(`An active session already exists for this batch (id: ${existingBatchSession.id})`);
      }
      throw new ConflictException('A session was already completed for this batch today.');
    }

    // Enforce: one active session per coach across all batches
    const existingCoachSession = await this.prisma.attendanceSession.findFirst({
      where: { coachId, date: today, endedAt: null },
      include: { batch: { select: { name: true } } },
    });
    if (existingCoachSession) {
      throw new ConflictException(
        `You already have an active session for batch "${existingCoachSession.batch.name}" (id: ${existingCoachSession.id}). End it before starting a new one.`,
      );
    }

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

    // Auto-record coach attendance as PRESENT
    await this.prisma.coachAttendance.create({
      data: {
        sessionId: session.id,
        coachId,
        batchId,
        date: today,
        status: CoachAttendanceStatus.PRESENT,
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
        coachAttendance: true,
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

  async getActiveSession(batchId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.prisma.attendanceSession.findFirst({
      where: { batchId, date: today, endedAt: null },
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
  }

  async getMyActiveSession(coachId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.prisma.attendanceSession.findFirst({
      where: { coachId, date: today, endedAt: null },
      include: { batch: { include: { venue: true } } },
    });
  }

  async getAllSessions(venueId?: string, coachId?: string) {
    const where: any = { endedAt: { not: null } };
    if (venueId) {
      where.batch = { venueId };
    }
    if (coachId) {
      where.coachId = coachId;
    }

    const sessions = await this.prisma.attendanceSession.findMany({
      where,
      include: {
        coach: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true, sport: { select: { name: true } } } },
        coachAttendance: { select: { status: true } },
        _count: { select: { attendances: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });

    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const stats = await this.prisma.attendance.groupBy({
          by: ['status'],
          where: { sessionId: s.id },
          _count: true,
        });
        const presentCount = stats.find((x) => x.status === AttendanceStatus.PRESENT)?._count ?? 0;
        const totalCount = stats.reduce((acc, x) => acc + x._count, 0);
        return { ...s, attendanceStats: { total: totalCount, present: presentCount, absent: totalCount - presentCount } };
      }),
    );

    return enriched;
  }

  async getSessionsForBatch(batchId: string, date?: string) {
    const where: any = { batchId };
    if (date) {
      where.date = new Date(date);
    }
    const sessions = await this.prisma.attendanceSession.findMany({
      where,
      include: {
        coach: { select: { id: true, name: true } },
        coachAttendance: { select: { status: true } },
        _count: { select: { attendances: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Attach attendance stats per session
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const stats = await this.prisma.attendance.groupBy({
          by: ['status'],
          where: { sessionId: s.id },
          _count: true,
        });
        const presentCount = stats.find((x) => x.status === AttendanceStatus.PRESENT)?._count ?? 0;
        const totalCount = stats.reduce((acc, x) => acc + x._count, 0);
        return { ...s, attendanceStats: { total: totalCount, present: presentCount, absent: totalCount - presentCount } };
      }),
    );

    return enriched;
  }

  async getSessionAttendance(sessionId: string, requesterId: string, requesterRole: UserRole) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { coachId: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (requesterRole === UserRole.COACH && session.coachId !== requesterId) {
      throw new ForbiddenException('You can only view attendance for your own sessions');
    }

    return this.prisma.attendance.findMany({
      where: { sessionId },
      include: { student: { select: { id: true, name: true, photoUrl: true } } },
      orderBy: { student: { name: 'asc' } },
    });
  }

  async getCoachSessionSummary(venueId?: string) {
    const where: any = { endedAt: { not: null } };
    if (venueId) {
      where.batch = { venueId };
    }

    const grouped = await this.prisma.attendanceSession.groupBy({
      by: ['coachId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const coachIds = grouped.map((g) => g.coachId);
    const coaches = await this.prisma.user.findMany({
      where: { id: { in: coachIds } },
      select: { id: true, name: true },
    });

    const coachMap = Object.fromEntries(coaches.map((c) => [c.id, c.name]));

    return grouped.map((g) => ({
      coachId: g.coachId,
      coachName: coachMap[g.coachId] ?? 'Unknown',
      sessionCount: g._count.id,
    }));
  }

  async getMyTodaySessions(coachId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
    return this.prisma.attendanceSession.findMany({
      where: { coachId, date: targetDate },
      select: { id: true, batchId: true, endedAt: true },
    });
  }

  async getCoachAttendanceHistory(
    coachId: string,
    requesterId: string,
    requesterRole: UserRole,
    months: number = 3,
  ) {
    if (requesterRole === UserRole.COACH && coachId !== requesterId) {
      throw new ForbiddenException('You can only view your own attendance');
    }

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    return this.prisma.coachAttendance.findMany({
      where: { coachId, date: { gte: since } },
      include: {
        session: { select: { id: true, startedAt: true, endedAt: true } },
        batch: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
