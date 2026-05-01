import { Injectable, NotFoundException } from '@nestjs/common';
import { FeeFrequency } from '@kheloge/database';
import { PrismaService } from '../../database/prisma.service';

export interface CreateFeeStructureDto {
  batchId: string;
  name: string;
  amount: number;
  frequency: FeeFrequency;
  dueDay?: number;
  lateFeeAmount?: number;
  discountAmount?: number;
}

export interface UpdateFeeStructureDto {
  name?: string;
  amount?: number;
  frequency?: FeeFrequency;
  dueDay?: number;
  lateFeeAmount?: number;
  discountAmount?: number;
  isActive?: boolean;
}

export interface FeeStructureFilters {
  batchId?: string;
  sportId?: string;
}

@Injectable()
export class FeeStructuresService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, filters: FeeStructureFilters = {}) {
    const batches = await this.prisma.batch.findMany({
      where: {
        venue: { organizationId },
        ...(filters.batchId && { id: filters.batchId }),
        ...(filters.sportId && { sportId: filters.sportId }),
      },
      select: {
        id: true,
        name: true,
        sportId: true,
        sport: { select: { id: true, name: true } },
        feePlans: true,
        _count: { select: { enrollments: { where: { isActive: true } } } },
      },
    });

    return batches.flatMap((b) =>
      b.feePlans.map((fp) => ({
        ...fp,
        amount: Number(fp.amount),
        lateFeeAmount: fp.lateFeeAmount ? Number(fp.lateFeeAmount) : null,
        discountAmount: fp.discountAmount ? Number(fp.discountAmount) : null,
        batchId: b.id,
        batchName: b.name,
        sport: b.sport,
        activeStudents: b._count.enrollments,
      })),
    );
  }

  async create(organizationId: string, dto: CreateFeeStructureDto) {
    // Verify batch belongs to this organization
    const batch = await this.prisma.batch.findFirst({
      where: { id: dto.batchId, venue: { organizationId } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    return this.prisma.feePlan.create({
      data: {
        batchId: dto.batchId,
        name: dto.name,
        amount: dto.amount,
        frequency: dto.frequency,
        dueDay: dto.dueDay,
        lateFeeAmount: dto.lateFeeAmount,
        discountAmount: dto.discountAmount,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateFeeStructureDto) {
    // Verify fee plan belongs to this organization via batch → venue
    const existing = await this.prisma.feePlan.findFirst({
      where: { id, batch: { venue: { organizationId } } },
    });
    if (!existing) throw new NotFoundException('Fee structure not found');

    return this.prisma.feePlan.update({
      where: { id },
      data: { ...dto },
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.feePlan.findFirst({
      where: { id, batch: { venue: { organizationId } } },
    });
    if (!existing) throw new NotFoundException('Fee structure not found');

    return this.prisma.feePlan.delete({ where: { id } });
  }
}
