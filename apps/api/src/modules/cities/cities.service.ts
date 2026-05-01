import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateCityDto {
  name: string;
  state?: string;
}

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.city.findMany({
      where: { organizationId, isActive: true },
      include: { _count: { select: { venues: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: { venues: { where: { isActive: true } } },
    });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  async create(organizationId: string, dto: CreateCityDto) {
    return this.prisma.city.create({ data: { ...dto, organizationId } });
  }

  async update(id: string, dto: Partial<CreateCityDto>) {
    return this.prisma.city.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    return this.prisma.city.update({ where: { id }, data: { isActive: false } });
  }
}
