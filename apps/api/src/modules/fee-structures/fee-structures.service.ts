import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateFeeStructureDto {
  batchId: string;
  amount: number;
  dueDay?: number;
}

export interface UpdateFeeStructureDto {
  amount?: number;
  dueDay?: number;
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
        fee: true,
        feeDueDay: true,
        sportId: true,
        sport: { select: { id: true, name: true } },
        _count: { select: { enrollments: { where: { isActive: true } } } },
      },
    });

    return batches.map((b) => ({
      batchId: b.id,
      batchName: b.name,
      amount: b.fee != null ? Number(b.fee) : null,
      dueDay: b.feeDueDay,
      sport: b.sport,
      activeStudents: b._count.enrollments,
    }));
  }

  async create(organizationId: string, dto: CreateFeeStructureDto) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: dto.batchId, venue: { organizationId } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    return this.prisma.batch.update({
      where: { id: dto.batchId },
      data: { fee: dto.amount, feeDueDay: dto.dueDay ?? 1 },
      select: { id: true, name: true, fee: true, feeDueDay: true },
    });
  }

  // id is batchId after this refactor
  async update(organizationId: string, id: string, dto: UpdateFeeStructureDto) {
    const existing = await this.prisma.batch.findFirst({
      where: { id, venue: { organizationId } },
    });
    if (!existing) throw new NotFoundException('Fee structure not found');

    return this.prisma.batch.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined ? { fee: dto.amount } : {}),
        ...(dto.dueDay !== undefined ? { feeDueDay: dto.dueDay } : {}),
      },
      select: { id: true, name: true, fee: true, feeDueDay: true },
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.batch.findFirst({
      where: { id, venue: { organizationId } },
    });
    if (!existing) throw new NotFoundException('Fee structure not found');

    return this.prisma.batch.update({
      where: { id },
      data: { fee: null },
      select: { id: true, name: true, fee: true },
    });
  }
}
