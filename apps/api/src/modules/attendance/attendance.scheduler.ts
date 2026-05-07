import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceService } from './attendance.service';
import { CoachAttendanceStatus } from '@kheloge/database';

const DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

@Injectable()
export class AttendanceScheduler {
  private readonly logger = new Logger(AttendanceScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Cron('*/10 * * * *')
  async autoCloseSessions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const openSessions = await this.prisma.attendanceSession.findMany({
      where: {
        endedAt: null,
        date: { gte: today, lt: tomorrow },
      },
      include: { batch: { select: { endTime: true } } },
    });

    const now = new Date();

    for (const session of openSessions) {
      const [hours, minutes] = session.batch.endTime.split(':').map(Number);
      const endDateTime = new Date(session.date);
      endDateTime.setHours(hours, minutes, 0, 0);
      const autoCutoff = new Date(endDateTime.getTime() + 60 * 60 * 1000);

      if (now > autoCutoff) {
        await this.attendanceService.endSession(session.id);
        this.logger.log(`Auto-closed session ${session.id} for batch ${session.batchId}`);
      }
    }
  }

  @Cron('*/10 * * * *')
  async autoMarkCoachAbsent() {
    const now = new Date();
    const todayDow = DOW[now.getDay()];
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const batches = await this.prisma.batch.findMany({
      where: { isActive: true, days: { has: todayDow as any } },
      select: {
        id: true,
        endTime: true,
        coaches: { select: { coachId: true } },
      },
    });

    for (const batch of batches) {
      const [h, m] = batch.endTime.split(':').map(Number);
      const endDateTime = new Date(todayStart);
      endDateTime.setHours(h, m, 0, 0);

      if (now <= endDateTime) continue;

      for (const { coachId } of batch.coaches) {
        const exists = await this.prisma.coachAttendance.findFirst({
          where: { coachId, batchId: batch.id, date: { gte: todayStart, lt: todayEnd } },
        });
        if (exists) continue;

        await this.prisma.coachAttendance.create({
          data: {
            sessionId: null,
            coachId,
            batchId: batch.id,
            date: todayStart,
            status: CoachAttendanceStatus.ABSENT,
          },
        });
        this.logger.log(`Auto-marked coach ${coachId} absent for batch ${batch.id}`);
      }
    }
  }
}
