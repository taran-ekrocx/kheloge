import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceService } from './attendance.service';

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
}
