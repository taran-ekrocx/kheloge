import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'venue';
}

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.venue.findMany({
      where: { organizationId, isActive: true },
      include: { sports: { where: { isActive: true }, include: { sport: true } }, city: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.venue.findUniqueOrThrow({
      where: { id },
      include: { sports: { where: { isActive: true }, include: { sport: true } }, city: true },
    });
  }

  async create(organizationId: string, data: any) {
    const { sportIds, ...rest } = data;
    const baseSlug = toSlug(rest.name ?? '');
    const existing = await this.prisma.venue.findMany({
      where: { organizationId, slug: { startsWith: baseSlug } },
      select: { slug: true },
    });
    let slug = baseSlug;
    if (existing.some(v => v.slug === slug)) {
      let i = 1;
      const used = new Set(existing.map(v => v.slug));
      while (used.has(`${baseSlug}-${i}`)) i++;
      slug = `${baseSlug}-${i}`;
    }
    const venue = await this.prisma.venue.create({ data: { ...rest, slug, organizationId } });
    if (sportIds?.length) await this.syncSports(venue.id, sportIds);
    return this.findOne(venue.id);
  }

  async update(id: string, data: any) {
    const { sportIds, ...rest } = data;
    if (Object.keys(rest).length) {
      await this.prisma.venue.update({ where: { id }, data: rest });
    }
    if (sportIds !== undefined) await this.syncSports(id, sportIds);
    return this.findOne(id);
  }

  async syncSports(venueId: string, sportIds: string[]) {
    for (const sportId of sportIds) {
      await this.prisma.venueSport.upsert({
        where: { venueId_sportId: { venueId, sportId } },
        create: { venueId, sportId, isActive: true },
        update: { isActive: true },
      });
    }
    await this.prisma.venueSport.updateMany({
      where: { venueId, ...(sportIds.length ? { sportId: { notIn: sportIds } } : {}) },
      data: { isActive: false },
    });
  }

  async deactivate(id: string) {
    return this.prisma.venue.update({ where: { id }, data: { isActive: false } });
  }
}
