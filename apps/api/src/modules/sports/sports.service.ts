import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateSportDto {
  name: string;
  icon?: string;
}

@Injectable()
export class SportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.sport.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sport = await this.prisma.sport.findUnique({ where: { id } });
    if (!sport) throw new NotFoundException('Sport not found');
    return sport;
  }

  async create(organizationId: string, dto: CreateSportDto) {
    return this.prisma.sport.create({ data: { ...dto, organizationId } });
  }

  async update(id: string, dto: Partial<CreateSportDto>) {
    return this.prisma.sport.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    return this.prisma.sport.update({ where: { id }, data: { isActive: false } });
  }

  async assignToVenue(venueId: string, sportId: string) {
    return this.prisma.venueSport.upsert({
      where: { venueId_sportId: { venueId, sportId } },
      create: { venueId, sportId, isActive: true },
      update: { isActive: true },
    });
  }

  async removeFromVenue(venueId: string, sportId: string) {
    return this.prisma.venueSport.updateMany({
      where: { venueId, sportId },
      data: { isActive: false },
    });
  }
}
