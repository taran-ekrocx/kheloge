import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudentsService } from './students.service';
import { PrismaService } from '../../database/prisma.service';
import { FileUploadService } from '../uploads/file-upload.service';
import { StudentStatus } from '@kheloge/database';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeStudent(overrides: Partial<{ id: string; status: StudentStatus }> = {}) {
  return {
    id: 'stu_1',
    name: 'Arjun Mehta',
    phone: '+919000000001',
    email: null,
    venueId: 'venue_1',
    status: StudentStatus.ENQUIRY,
    dob: null,
    guardians: [],
    enrollments: [],
    ...overrides,
  };
}

function makeBatch(overrides: Partial<{ id: string; capacity: number }> = {}) {
  return {
    id: 'batch_1',
    name: 'Cricket Morning U-14',
    capacity: 20,
    ...overrides,
  };
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      student: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      batch: {
        findUniqueOrThrow: jest.fn(),
      },
      enrollment: {
        count: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      attendance: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FileUploadService, useValue: {} },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get(PrismaService);
  });

  // ── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a student with ENQUIRY status', async () => {
      const created = makeStudent();
      (prisma.student.create as jest.Mock).mockResolvedValue(created);

      const result = await service.create('venue_1', {
        name: 'Arjun Mehta',
        phone: '+919000000001',
      });

      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Arjun Mehta',
            phone: '+919000000001',
            venueId: 'venue_1',
            status: StudentStatus.ENQUIRY,
          }),
        }),
      );
      expect(result.status).toBe(StudentStatus.ENQUIRY);
    });

    it('parses dob string to Date when provided', async () => {
      const created = makeStudent({ id: 'stu_dob' });
      (prisma.student.create as jest.Mock).mockResolvedValue(created);

      await service.create('venue_1', { name: 'Test', dob: '2010-05-15' });

      const callArg = (prisma.student.create as jest.Mock).mock.calls[0][0];
      expect(callArg.data.dob).toBeInstanceOf(Date);
      expect(callArg.data.dob.getFullYear()).toBe(2010);
    });
  });

  // ── transitionStatus ───────────────────────────────────────────────────

  describe('transitionStatus', () => {
    it('transitions ENQUIRY → TRIAL (happy path)', async () => {
      const student = makeStudent({ status: StudentStatus.ENQUIRY });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(student);
      const updated = makeStudent({ status: StudentStatus.TRIAL });
      (prisma.student.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.transitionStatus('stu_1', StudentStatus.TRIAL);
      expect(result.status).toBe(StudentStatus.TRIAL);
    });

    it('transitions TRIAL → ACTIVE (happy path)', async () => {
      const student = makeStudent({ status: StudentStatus.TRIAL });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(student);
      const updated = makeStudent({ status: StudentStatus.ACTIVE });
      (prisma.student.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.transitionStatus('stu_1', StudentStatus.ACTIVE);
      expect(result.status).toBe(StudentStatus.ACTIVE);
    });

    it('rejects an invalid transition (ENQUIRY → ACTIVE is not allowed)', async () => {
      const student = makeStudent({ status: StudentStatus.ENQUIRY });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(student);

      await expect(
        service.transitionStatus('stu_1', StudentStatus.ACTIVE),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when student does not exist', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.transitionStatus('no_such_id', StudentStatus.TRIAL),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── enroll ─────────────────────────────────────────────────────────────

  describe('enroll', () => {
    it('enrolls a student when batch has capacity', async () => {
      (prisma.batch.findUniqueOrThrow as jest.Mock).mockResolvedValue(makeBatch({ capacity: 20 }));
      (prisma.enrollment.count as jest.Mock).mockResolvedValue(10); // 10 of 20 slots taken
      const enrollment = { id: 'enr_1', studentId: 'stu_1', batchId: 'batch_1', isActive: true };
      (prisma.enrollment.upsert as jest.Mock).mockResolvedValue(enrollment);

      const result = await service.enroll('stu_1', { batchId: 'batch_1' });
      expect(result.isActive).toBe(true);
      expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ studentId: 'stu_1', batchId: 'batch_1' }),
        }),
      );
    });

    it('throws when batch is at full capacity', async () => {
      (prisma.batch.findUniqueOrThrow as jest.Mock).mockResolvedValue(makeBatch({ capacity: 10 }));
      (prisma.enrollment.count as jest.Mock).mockResolvedValue(10); // 10 of 10 — full

      await expect(
        service.enroll('stu_1', { batchId: 'batch_1' }),
      ).rejects.toThrow('Batch is at full capacity');
    });
  });

  // ── unenroll ───────────────────────────────────────────────────────────

  describe('unenroll', () => {
    it('marks enrollment as inactive with leftAt timestamp', async () => {
      const updated = { id: 'enr_1', isActive: false, leftAt: new Date() };
      (prisma.enrollment.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.unenroll('stu_1', 'batch_1');
      expect(result.isActive).toBe(false);
      expect(prisma.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });
});
