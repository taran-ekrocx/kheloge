import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsArray, IsEnum, IsDateString, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BatchDay } from '@kheloge/database';
import { PrismaService } from '../../database/prisma.service';

export class CreateBatchDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() venueId: string;
  @ApiProperty() @IsString() sportId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) capacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() ageMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() ageMax?: number;
  @ApiProperty() @IsString() startTime: string;
  @ApiProperty() @IsString() endTime: string;
  @ApiProperty({ enum: BatchDay, isArray: true }) @IsArray() @IsEnum(BatchDay, { each: true }) days: BatchDay[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional({ description: 'Coach user IDs to assign' }) @IsOptional() @IsArray() coachIds?: string[];
  @ApiPropertyOptional({ description: 'Monthly fee amount for the batch' }) @IsOptional() @IsNumber() feeAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ description: 'Student IDs to enroll on creation' }) @IsOptional() @IsArray() studentIds?: string[];
}

export class UpdateBatchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) capacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() ageMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() ageMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endTime?: string;
  @ApiPropertyOptional({ enum: BatchDay, isArray: true }) @IsOptional() @IsArray() @IsEnum(BatchDay, { each: true }) days?: BatchDay[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional({ description: 'Coach org-user IDs to assign' }) @IsOptional() @IsArray() coachIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ description: 'Monthly fee amount for the batch' }) @IsOptional() @IsNumber() fee?: number;
}

export interface BatchFilters {
  sportId?: string;
  venueId?: string;
  coachId?: string;
  status?: 'active' | 'inactive';
}

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, filters: BatchFilters = {}) {
    const { sportId, venueId, coachId, status } = filters;
    const isActive = status === 'inactive' ? false : status === 'active' ? true : undefined;

    return this.prisma.batch.findMany({
      where: {
        venue: { organizationId },
        ...(sportId ? { sportId } : {}),
        ...(venueId ? { venueId } : {}),
        ...(coachId ? { coaches: { some: { coachId } } } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        sport: true,
        venue: { select: { id: true, name: true } },
        coaches: {
          include: {
            coach: { select: { id: true, name: true, photoUrl: true } },
          },
        },
        _count: { select: { enrollments: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: {
        sport: true,
        venue: { select: { id: true, name: true } },
        coaches: {
          include: {
            coach: { select: { id: true, name: true, photoUrl: true } },
          },
        },
        enrollments: {
          where: { isActive: true },
          include: {
            student: { select: { id: true, name: true, photoUrl: true, phone: true } },
          },
        },
        demoStudents: {
          where: { convertedToRegular: false },
          select: { id: true, name: true, phone: true, sport: true, status: true, demoStartDate: true, demoEndDate: true },
        },
        _count: { select: { enrollments: true } },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async create(dto: CreateBatchDto) {
    const { coachIds, feeAmount, studentIds, ...rest } = dto;
    const batch = await this.prisma.batch.create({
      data: {
        ...rest,
        startDate: rest.startDate ? new Date(rest.startDate) : undefined,
        endDate: rest.endDate ? new Date(rest.endDate) : undefined,
        fee: feeAmount ?? undefined,
        coaches: coachIds?.length
          ? { create: coachIds.map((id, i) => ({ coachId: id, isPrimary: i === 0 })) }
          : undefined,
      },
      include: {
        sport: true,
        venue: { select: { id: true, name: true } },
        coaches: { include: { coach: { select: { id: true, name: true } } } },
      },
    });

    if (studentIds?.length) {
      await this.prisma.enrollment.createMany({
        data: studentIds.map((studentId) => ({ studentId, batchId: batch.id })),
        skipDuplicates: true,
      });
    }

    return batch;
  }

  async update(id: string, dto: UpdateBatchDto) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Batch not found');
    const { coachIds: _coachIds, ...fields } = dto;
    return this.prisma.batch.update({
      where: { id },
      data: {
        ...fields,
        startDate: fields.startDate ? new Date(fields.startDate) : undefined,
        endDate: fields.endDate ? new Date(fields.endDate) : undefined,
      },
    });
  }

  async syncEnrollments(batchId: string, studentIds: string[]) {
    const current = await this.prisma.enrollment.findMany({
      where: { batchId, isActive: true },
      select: { studentId: true },
    });
    const currentSet = new Set(current.map((e) => e.studentId));
    const newSet = new Set(studentIds);

    const toAdd = studentIds.filter((id) => !currentSet.has(id));
    const toRemove = [...currentSet].filter((id) => !newSet.has(id));

    if (toAdd.length) {
      await this.prisma.enrollment.createMany({
        data: toAdd.map((studentId) => ({ studentId, batchId })),
        skipDuplicates: true,
      });
      await this.prisma.enrollment.updateMany({
        where: { batchId, studentId: { in: toAdd }, isActive: false },
        data: { isActive: true, leftAt: null },
      });
    }
    if (toRemove.length) {
      await this.prisma.enrollment.updateMany({
        where: { batchId, studentId: { in: toRemove } },
        data: { isActive: false, leftAt: new Date() },
      });
    }
  }

  async syncDemoStudents(batchId: string, demoStudentIds: string[]) {
    const current = await this.prisma.demoStudent.findMany({
      where: { batchId },
      select: { id: true },
    });
    const currentIds = new Set(current.map((d) => d.id));
    const newSet = new Set(demoStudentIds);

    const toAssign = demoStudentIds.filter((id) => !currentIds.has(id));
    const toUnassign = [...currentIds].filter((id) => !newSet.has(id));

    if (toAssign.length) {
      await this.prisma.demoStudent.updateMany({
        where: { id: { in: toAssign } },
        data: { batchId },
      });
    }
    if (toUnassign.length) {
      await this.prisma.demoStudent.updateMany({
        where: { id: { in: toUnassign }, batchId },
        data: { batchId: null },
      });
    }
  }

  async reassignCoach(batchId: string, orgUserId: string) {
    await this.prisma.batchCoach.deleteMany({ where: { batchId } });

    if (orgUserId) {
      const orgUser = await this.prisma.organizationUser.findUnique({
        where: { id: orgUserId },
        select: { userId: true },
      });
      if (!orgUser) throw new NotFoundException('Coach not found');
      await this.prisma.batchCoach.create({
        data: { batchId, coachId: orgUser.userId, isPrimary: true },
      });
    }
  }

  async reassignCoaches(batchId: string, ids: string[]) {
    await this.prisma.batchCoach.deleteMany({ where: { batchId } });

    if (ids.length > 0) {
      // Try to resolve as OrganizationUser IDs first; unmatched IDs are treated as User IDs directly.
      // This handles both the creation flow (orgUser.ids from frontend) and the edit flow
      // (User.ids pre-populated from existing batch.coaches[].id).
      const orgUsers = await this.prisma.organizationUser.findMany({
        where: { id: { in: ids } },
        select: { id: true, userId: true },
      });
      const orgUserMap = new Map(orgUsers.map((ou) => [ou.id, ou.userId]));
      const userIds = ids.map((id) => orgUserMap.get(id) ?? id);
      await this.prisma.batchCoach.createMany({
        data: userIds.map((coachId, i) => ({
          batchId,
          coachId,
          isPrimary: i === 0,
        })),
        skipDuplicates: true,
      });
    }
  }

  async remove(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Batch not found');
    return this.prisma.batch.update({ where: { id }, data: { isActive: false } });
  }

  async getSchedule(venueId: string) {
    return this.prisma.batch.findMany({
      where: { venueId, isActive: true },
      select: { id: true, name: true, days: true, startTime: true, endTime: true, sport: true },
    });
  }
}
