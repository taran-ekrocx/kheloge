import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentStatus, AttendanceStatus } from '@kheloge/database';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { FileUploadService } from '../uploads/file-upload.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface CreateStudentDto {
  name: string;
  phone?: string;
  email?: string;
  dob?: string;
  address?: string;
  medicalNotes?: string;
  state?: string;
  district?: string;
  city?: string;
  region?: string;
  cityId?: string;
  sportInterest?: string;
  status?: StudentStatus;
  batchIds?: string[];
  guardians?: Array<{ name: string; phone: string; email?: string; relation: string; isPrimary?: boolean }>;
}

export interface EnrollStudentDto {
  batchId: string;
}

export interface RecordAttendanceDto {
  batchId: string;
  status: AttendanceStatus;
  date?: string;
  notes?: string;
}

// Valid forward/backward transitions for the enrolment workflow
const STATUS_TRANSITIONS: Record<StudentStatus, StudentStatus[]> = {
  [StudentStatus.ENQUIRY]: [StudentStatus.TRIAL, StudentStatus.INACTIVE],
  [StudentStatus.TRIAL]: [StudentStatus.ACTIVE, StudentStatus.ENQUIRY, StudentStatus.INACTIVE],
  [StudentStatus.ACTIVE]: [StudentStatus.INACTIVE, StudentStatus.GRADUATED, StudentStatus.ON_HOLD],
  [StudentStatus.INACTIVE]: [StudentStatus.ENQUIRY, StudentStatus.TRIAL, StudentStatus.ACTIVE],
  [StudentStatus.ON_HOLD]: [StudentStatus.ACTIVE, StudentStatus.INACTIVE],
  [StudentStatus.GRADUATED]: [],
};

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private fileUpload: FileUploadService,
  ) {}

  async findAll(venueId: string, opts: { search?: string; status?: StudentStatus | 'all'; sportId?: string; batchId?: string; coachUserId?: string; from?: string; to?: string } = {}) {
    const { search, status, sportId, batchId, coachUserId, from, to } = opts;

    // When a coach queries, resolve their batch IDs to scope the student list
    let coachBatchIds: string[] | undefined;
    if (coachUserId) {
      const batchCoaches = await this.prisma.batchCoach.findMany({
        where: { coachId: coachUserId },
        select: { batchId: true },
      });
      coachBatchIds = batchCoaches.map((bc) => bc.batchId);
    }

    return this.prisma.student.findMany({
      where: {
        venueId,
        ...(!status || status === 'all'
          ? { status: { notIn: [StudentStatus.INACTIVE] } }
          : { status: status as StudentStatus }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(coachBatchIds
          ? {
              enrollments: {
                some: {
                  isActive: true,
                  batchId: { in: coachBatchIds },
                  ...(sportId && { batch: { sportId } }),
                },
              },
            }
          : sportId || batchId || from || to
            ? {
                enrollments: {
                  some: {
                    ...(batchId && { batchId }),
                    ...(sportId && { batch: { sportId } }),
                    // Active during the requested month: joined before month end and not left before month start
                    ...(from && { joinedAt: { lte: new Date(to ?? from) } }),
                    ...(from && {
                      OR: [
                        { isActive: true },
                        { leftAt: { gte: new Date(from) } },
                      ],
                    }),
                  },
                },
              }
            : {}),
      },
      include: { guardians: true, enrollments: { include: { batch: { include: { sport: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async findAllForOrg(orgId: string, opts: { search?: string; status?: StudentStatus | 'all'; sportId?: string; batchId?: string } = {}) {
    const { search, status, sportId, batchId } = opts;
    return this.prisma.student.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { venue: { organizationId: orgId } },
        ],
        ...(!status || status === 'all'
          ? { status: { notIn: [StudentStatus.INACTIVE] } }
          : { status: status as StudentStatus }),
        ...(search && {
          AND: [
            {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          ],
        }),
        ...(sportId || batchId
          ? {
              enrollments: {
                some: {
                  isActive: true,
                  ...(batchId && { batchId }),
                  ...(sportId && { batch: { sportId } }),
                },
              },
            }
          : {}),
      },
      include: { guardians: true, enrollments: { include: { batch: { include: { sport: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        guardians: true,
        enrollments: { include: { batch: { include: { sport: true } } } },
        attendances: { orderBy: { date: 'desc' }, take: 30, include: { batch: { select: { name: true, sport: { select: { name: true } } } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async create(venueId: string | undefined, orgId: string, dto: CreateStudentDto) {
    const { guardians, dob, cityId, sportInterest, status, batchIds, ...rest } = dto;
    const student = await this.prisma.student.create({
      data: {
        ...rest,
        venueId: venueId ?? null,
        organizationId: orgId,
        status: status ?? StudentStatus.ENQUIRY,
        dob: dob ? new Date(dob) : undefined,
        guardians: guardians ? { create: guardians } : undefined,
      },
      include: { guardians: true, enrollments: { include: { batch: { include: { sport: true } } } } },
    });

    if (batchIds && batchIds.length > 0) {
      for (const batchId of batchIds) {
        try {
          await this.enroll(student.id, { batchId });
        } catch {
          // skip batches that are full or invalid
        }
      }
      return this.prisma.student.findUnique({
        where: { id: student.id },
        include: { guardians: true, enrollments: { include: { batch: { include: { sport: true } } } } },
      });
    }

    return student;
  }

  async transitionStatus(id: string, newStatus: StudentStatus) {
    const student = await this.prisma.student.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!student) throw new NotFoundException('Student not found');
    const allowed = STATUS_TRANSITIONS[student.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${student.status} to ${newStatus}`);
    }
    return this.prisma.student.update({ where: { id }, data: { status: newStatus } });
  }

  async getAttendance(studentId: string, startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return this.prisma.attendance.findMany({
      where: { studentId, date: { gte: start, lte: end } },
      include: { batch: { include: { sport: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async recordAttendance(studentId: string, dto: RecordAttendanceDto) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');
    const date = dto.date ? new Date(dto.date) : new Date();
    date.setHours(0, 0, 0, 0);
    return this.prisma.attendance.upsert({
      where: { batchId_studentId_date: { batchId: dto.batchId, studentId, date } },
      create: { batchId: dto.batchId, studentId, date, status: dto.status, notes: dto.notes },
      update: { status: dto.status, notes: dto.notes },
    });
  }

  async update(id: string, dto: Partial<CreateStudentDto>) {
    const { guardians, dob, ...rest } = dto;
    return this.prisma.student.update({
      where: { id },
      data: { ...rest, dob: dob ? new Date(dob) : undefined },
    });
  }

  async enroll(studentId: string, dto: EnrollStudentDto) {
    // Check batch capacity
    const batch = await this.prisma.batch.findUniqueOrThrow({ where: { id: dto.batchId } });
    const enrollmentCount = await this.prisma.enrollment.count({
      where: { batchId: dto.batchId, isActive: true },
    });
    if (enrollmentCount >= batch.capacity) {
      throw new Error('Batch is at full capacity');
    }
    return this.prisma.enrollment.upsert({
      where: { studentId_batchId: { studentId, batchId: dto.batchId } },
      create: { studentId, batchId: dto.batchId },
      update: { isActive: true, leftAt: null },
    });
  }

  async unenroll(studentId: string, batchId: string) {
    return this.prisma.enrollment.update({
      where: { studentId_batchId: { studentId, batchId } },
      data: { isActive: false, leftAt: new Date() },
    });
  }

  async deactivate(id: string) {
    return this.prisma.student.update({
      where: { id },
      data: { status: StudentStatus.INACTIVE },
    });
  }

  /**
   * Generates a QR code PNG buffer for the student.
   * The encoded payload contains studentId and name so a scanner
   * can perform a QR-based check-in via POST /attendance/qr-checkin.
   */
  async generateQrCode(id: string): Promise<Buffer> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, name: true, venueId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const payload = JSON.stringify({ studentId: student.id, name: student.name, venueId: student.venueId });
    return QRCode.toBuffer(payload, { type: 'png', width: 300, margin: 2 });
  }

  /**
   * Generates a Student ID card as a PDF (A6 portrait).
   * Includes student name, batch/sport, enrollment date, QR code for check-in,
   * and a placeholder area for the student photo if a photoUrl is stored.
   */
  async generateIdCard(id: string): Promise<Buffer> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        venue: { include: { organization: true } },
        enrollments: {
          where: { isActive: true },
          include: { batch: { include: { sport: true } } },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Build QR payload (same as check-in endpoint)
    const qrPayload = JSON.stringify({ studentId: student.id, name: student.name, venueId: student.venueId });
    const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', width: 200, margin: 1 });

    const org = student.venue.organization;
    const venue = student.venue;
    const enrollment = student.enrollments[0] ?? null;
    const brand = venue.primaryColor ?? '#1d4ed8';

    // A6 portrait: 105mm × 148mm → ~298 × 420 pts
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A6', margin: 18 });
      const chunks: Buffer[] = [];

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;   // ~297.6
      const pageH = doc.page.height;  // ~419.5
      const margin = 18;
      const innerW = pageW - margin * 2;

      // ── Branded header strip ─────────────────────────────────
      doc
        .rect(0, 0, pageW, 46)
        .fill(brand);

      doc
        .fontSize(14)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text(org.name, margin, 10, { width: innerW, align: 'center' });

      doc
        .fontSize(7)
        .fillColor('#e0e7ff')
        .font('Helvetica')
        .text('Student ID Card', margin, 28, { width: innerW, align: 'center' });

      // ── Photo area ───────────────────────────────────────────
      const photoSize = 64;
      const photoX = Math.floor((pageW - photoSize) / 2);
      const photoY = 56;

      doc
        .rect(photoX, photoY, photoSize, photoSize)
        .fillAndStroke('#f3f4f6', '#d1d5db');

      doc
        .fontSize(7)
        .fillColor('#9ca3af')
        .text('Photo', photoX, photoY + photoSize / 2 - 4, { width: photoSize, align: 'center' });

      // ── Student name ─────────────────────────────────────────
      const nameY = photoY + photoSize + 8;
      doc
        .fontSize(13)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text(student.name, margin, nameY, { width: innerW, align: 'center' })
        .font('Helvetica');

      // ── Batch / sport row ─────────────────────────────────────
      let detailY = nameY + 20;
      if (enrollment) {
        const batchLabel = `${enrollment.batch.sport?.name ?? 'Sport'} — ${enrollment.batch.name}`;
        doc
          .fontSize(9)
          .fillColor('#4b5563')
          .text(batchLabel, margin, detailY, { width: innerW, align: 'center' });
        detailY += 14;
      }

      // ── Venue & enrollment date ───────────────────────────────
      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text(venue.name, margin, detailY, { width: innerW, align: 'center' });
      detailY += 12;

      const enrolledStr = student.enrolledAt.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
      doc
        .fontSize(7)
        .fillColor('#9ca3af')
        .text(`Enrolled: ${enrolledStr}`, margin, detailY, { width: innerW, align: 'center' });

      // ── QR code ───────────────────────────────────────────────
      const qrSize = 72;
      const qrX = Math.floor((pageW - qrSize) / 2);
      const qrY = pageH - margin - qrSize - 18;

      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      doc
        .fontSize(6)
        .fillColor('#9ca3af')
        .text('Scan to check in', margin, qrY + qrSize + 2, { width: innerW, align: 'center' });

      // ── Bottom brand strip ────────────────────────────────────
      doc
        .rect(0, pageH - 14, pageW, 14)
        .fill(brand);

      doc.end();
    });
  }

  /**
   * Uploads a student photo to R2 (photos/ folder) and persists the URL on the student record.
   */
  async uploadPhoto(id: string, buffer: Buffer, mimeType: string): Promise<string> {
    const student = await this.prisma.student.findUnique({ where: { id }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');

    const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
    const fileName = `${id}-${uuidv4()}${ext}`;

    const url = await this.fileUpload.upload('photos', fileName, buffer, mimeType);
    await this.prisma.student.update({ where: { id }, data: { photoUrl: url } });
    return url;
  }

  /**
   * Generates the student ID card PDF, uploads it to R2 (id-cards/ folder),
   * stores the URL on the student record, and returns the public URL.
   */
  async generateAndUploadIdCard(id: string): Promise<string> {
    const pdf = await this.generateIdCard(id);
    const fileName = `${id}-${uuidv4()}.pdf`;
    const url = await this.fileUpload.upload('id-cards', fileName, pdf, 'application/pdf');
    await this.prisma.student.update({ where: { id }, data: { idCardUrl: url } });
    return url;
  }
}
