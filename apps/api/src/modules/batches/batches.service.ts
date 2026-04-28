import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsArray, IsEnum, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BatchDay, FeeFrequency } from '@kheloge/database';
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
  @ApiPropertyOptional({ description: 'Monthly fee amount to create a default FeePlan' }) @IsOptional() @IsNumber() feeAmount?: number;
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
        _count: { select: { enrollments: true } },
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
        _count: { select: { enrollments: true } },
        feePlans: { where: { isActive: true } },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async create(dto: CreateBatchDto) {
    const { coachIds, feeAmount, ...rest } = dto;
    return this.prisma.batch.create({
      data: {
        ...rest,
        startDate: rest.startDate ? new Date(rest.startDate) : undefined,
        endDate: rest.endDate ? new Date(rest.endDate) : undefined,
        coaches: coachIds?.length
          ? { create: coachIds.map((id, i) => ({ coachId: id, isPrimary: i === 0 })) }
          : undefined,
        feePlans: feeAmount
          ? {
              create: {
                name: 'Monthly Fee',
                amount: feeAmount,
                frequency: FeeFrequency.MONTHLY,
              },
            }
          : undefined,
      },
      include: {
        sport: true,
        venue: { select: { id: true, name: true } },
        coaches: { include: { coach: { select: { id: true, name: true } } } },
        feePlans: true,
      },
    });
  }

  async update(id: string, dto: UpdateBatchDto) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Batch not found');
    return this.prisma.batch.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
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

  async reassignCoaches(batchId: string, orgUserIds: string[]) {
    await this.prisma.batchCoach.deleteMany({ where: { batchId } });

    if (orgUserIds.length > 0) {
      const orgUsers = await this.prisma.organizationUser.findMany({
        where: { id: { in: orgUserIds } },
        select: { id: true, userId: true },
      });
      const userIdMap = new Map(orgUsers.map((ou) => [ou.id, ou.userId]));
      await this.prisma.batchCoach.createMany({
        data: orgUserIds
          .filter((orgUserId) => userIdMap.has(orgUserId))
          .map((orgUserId, i) => ({
            batchId,
            coachId: userIdMap.get(orgUserId)!,
            isPrimary: i === 0,
          })),
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
