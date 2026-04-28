import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceGateway } from './attendance.gateway';
import { AttendanceStatus } from '@kheloge/database';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<{ id: string; endedAt: Date | null }> = {}) {
  return {
    id: 'session_1',
    batchId: 'batch_1',
    coachId: 'coach_1',
    date: new Date('2026-04-28T00:00:00.000Z'),
    startedAt: new Date(),
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    batch: {
      id: 'batch_1',
      sport: { id: 'sport_1', name: 'Cricket' },
      enrollments: [],
    },
    coach: { id: 'coach_1', name: 'Rahul Coach' },
    ...overrides,
  };
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      attendanceSession: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendance: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      enrollment: {
        findMany: jest.fn(),
      },
      batchCoach: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AttendanceGateway, useValue: { emitAttendanceUpdate: jest.fn(), emitQrCheckin: jest.fn() } },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prisma = module.get(PrismaService);
  });

  // ── startSession ───────────────────────────────────────────────────────

  describe('startSession', () => {
    it('creates a session when no active session exists for the batch today', async () => {
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
      const created = makeSession();
      (prisma.attendanceSession.create as jest.Mock).mockResolvedValue(created);

      const result = await service.startSession('batch_1', 'coach_1');

      expect(prisma.attendanceSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ batchId: 'batch_1', endedAt: null }),
        }),
      );
      expect(prisma.attendanceSession.create).toHaveBeenCalled();
      expect(result.id).toBe('session_1');
    });

    it('throws ConflictException when an active session already exists for the batch today', async () => {
      const existingSession = makeSession({ id: 'session_existing' });
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(existingSession);

      await expect(service.startSession('batch_1', 'coach_1')).rejects.toThrow(ConflictException);
      await expect(service.startSession('batch_1', 'coach_1')).rejects.toThrow(
        'An active session already exists for this batch (id: session_existing)',
      );
      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
    });

    it('allows a new session for the same batch if the previous one has ended', async () => {
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
      const created = makeSession({ id: 'session_2' });
      (prisma.attendanceSession.create as jest.Mock).mockResolvedValue(created);

      const result = await service.startSession('batch_1', 'coach_1');
      expect(result.id).toBe('session_2');
    });
  });

  // ── mark ───────────────────────────────────────────────────────────────

  describe('mark', () => {
    it('throws ForbiddenException when session has already ended', async () => {
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(
        makeSession({ endedAt: new Date() }),
      );

      await expect(
        service.mark('batch_1', { records: [{ studentId: 'stu_1', status: AttendanceStatus.PRESENT }] }, 'coach_1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('upserts attendance records when session is active', async () => {
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
      const record = {
        id: 'att_1', batchId: 'batch_1', studentId: 'stu_1',
        date: new Date(), status: AttendanceStatus.PRESENT,
      };
      (prisma.attendance.upsert as jest.Mock).mockResolvedValue(record);

      const results = await service.mark(
        'batch_1',
        { records: [{ studentId: 'stu_1', status: AttendanceStatus.PRESENT }] },
        'coach_1',
      );

      expect(prisma.attendance.upsert).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });
  });
});
