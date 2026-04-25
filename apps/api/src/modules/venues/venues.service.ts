import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.venue.findMany({
      where: { organizationId, isActive: true },
      include: { sports: { include: { sport: true } }, city: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.venue.findUniqueOrThrow({
      where: { id },
      include: { sports: { include: { sport: true } }, city: true },
    });
  }

  async create(organizationId: string, data: any) {
    return this.prisma.venue.create({ data: { ...data, organizationId } });
  }

  async update(id: string, data: any) {
    return this.prisma.venue.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    return this.prisma.venue.update({ where: { id }, data: { isActive: false } });
  }
}
