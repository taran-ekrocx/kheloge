import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsEmail, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { PrismaService } from '../../database/prisma.service';
import { normalizePhone } from '../../common/utils/phone';

export class AssignCoachDto {
  @ApiProperty({ description: 'Batch ID to assign the coach to' })
  @IsString()
  batchId: string;

  @ApiPropertyOptional({ description: 'Whether this coach is the primary coach for the batch' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateCoachDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;
}

export class UpdateCoachDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;
}

@Injectable()
export class CoachesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId, role: UserRole.COACH, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            photoUrl: true,
            coachBatches: {
              include: {
                batch: {
                  select: {
                    id: true,
                    name: true,
                    sport: { select: { id: true, name: true } },
                    venue: { select: { id: true, name: true } },
                    startTime: true,
                    endTime: true,
                    days: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        venue: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orgUsers.map(({ user, venue, ...rest }) => ({
      ...rest,
      userId: user.id,
      name: user.name,
      phone: user.phone,
      photoUrl: user.photoUrl,
      venue,
      batches: user.coachBatches.map((bc) => ({
        batchId: bc.batchId,
        isPrimary: bc.isPrimary,
        ...bc.batch,
      })),
    }));
  }

  async findOne(organizationId: string, orgUserId: string) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, role: UserRole.COACH, isActive: true },
      include: {
        user: {
          include: {
            coachBatches: {
              include: {
                batch: {
                  include: {
                    sport: true,
                    venue: { select: { id: true, name: true } },
                    _count: { select: { enrollments: true } },
                  },
                },
              },
            },
          },
        },
        venue: { select: { id: true, name: true } },
      },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

    const { user, venue, ...rest } = orgUser;
    return {
      ...rest,
      userId: user.id,
      name: user.name,
      phone: user.phone,
      photoUrl: user.photoUrl,
      venue,
      batches: user.coachBatches.map((bc) => ({
        batchId: bc.batchId,
        isPrimary: bc.isPrimary,
        ...bc.batch,
      })),
    };
  }

  // ── Venue-scoped coach CRUD ──────────────────────────────────────────────

  private mapOrgUser(orgUser: any) {
    const { user, venue, isActive, locationCity, ...rest } = orgUser;
    return {
      ...rest,
      userId: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email ?? undefined,
      photoUrl: user.photoUrl,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      city: locationCity ?? undefined,
      venue,
      batches: (user.coachBatches ?? []).map((bc: any) => ({
        batchId: bc.batchId,
        isPrimary: bc.isPrimary,
        ...bc.batch,
      })),
    };
  }

  async findByVenue(organizationId: string, venueId: string) {
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId, venueId, role: UserRole.COACH, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            photoUrl: true,
            coachBatches: {
              include: {
                batch: {
                  select: {
                    id: true,
                    name: true,
                    sport: { select: { id: true, name: true } },
                    venue: { select: { id: true, name: true } },
                    startTime: true,
                    endTime: true,
                    days: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        venue: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orgUsers.map((ou) => this.mapOrgUser(ou));
  }

  async createCoach(organizationId: string, venueId: string, dto: CreateCoachDto) {
    // Verify venue belongs to org
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, organizationId },
    });
    if (!venue) throw new NotFoundException('Venue not found');

    dto.phone = normalizePhone(dto.phone);
    // Find or create the underlying user
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone: dto.phone, name: dto.name, email: dto.email ?? null },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: dto.name, ...(dto.email !== undefined ? { email: dto.email } : {}) },
      });
    }

    // Check for existing active coach membership at this venue
    const existing = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organizationId, venueId, role: UserRole.COACH, isActive: true },
    });
    if (existing) throw new ConflictException('Coach already exists at this venue');

    const isActive = dto.status !== 'INACTIVE';
    const orgUser = await this.prisma.organizationUser.create({
      data: {
        userId: user.id,
        organizationId,
        venueId,
        role: UserRole.COACH,
        isActive,
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.district !== undefined ? { district: dto.district } : {}),
        ...(dto.city !== undefined ? { locationCity: dto.city } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
      },
      include: {
        user: {
          select: {
            id: true, name: true, phone: true, email: true, photoUrl: true,
            coachBatches: { include: { batch: { select: { id: true, name: true, sport: { select: { id: true, name: true } } } } } },
          },
        },
        venue: { select: { id: true, name: true } },
      },
    });

    return this.mapOrgUser(orgUser);
  }

  async updateCoach(organizationId: string, venueId: string, orgUserId: string, dto: UpdateCoachDto) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, venueId, role: UserRole.COACH },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

    // Update user fields
    const userUpdate: any = {};
    if (dto.name !== undefined) userUpdate.name = dto.name;
    if (dto.phone !== undefined) userUpdate.phone = normalizePhone(dto.phone);
    if (dto.email !== undefined) userUpdate.email = dto.email;
    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({ where: { id: orgUser.userId }, data: userUpdate });
    }

    // Update org user fields
    const orgUserUpdate: any = {};
    if (dto.status !== undefined) orgUserUpdate.isActive = dto.status === 'ACTIVE';
    if (dto.state !== undefined) orgUserUpdate.state = dto.state;
    if (dto.district !== undefined) orgUserUpdate.district = dto.district;
    if (dto.city !== undefined) orgUserUpdate.locationCity = dto.city;
    if (dto.region !== undefined) orgUserUpdate.region = dto.region;
    if (Object.keys(orgUserUpdate).length > 0) {
      await this.prisma.organizationUser.update({ where: { id: orgUserId }, data: orgUserUpdate });
    }

    const updated = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId },
      include: {
        user: {
          select: {
            id: true, name: true, phone: true, email: true, photoUrl: true,
            coachBatches: { include: { batch: { select: { id: true, name: true, sport: { select: { id: true, name: true } } } } } },
          },
        },
        venue: { select: { id: true, name: true } },
      },
    });

    return this.mapOrgUser(updated);
  }

  async removeCoach(organizationId: string, venueId: string, orgUserId: string) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, venueId, role: UserRole.COACH },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

    await this.prisma.organizationUser.update({
      where: { id: orgUserId },
      data: { isActive: false },
    });

    return { success: true };
  }

  async assignToBatch(organizationId: string, orgUserId: string, dto: AssignCoachDto) {
    // Resolve org user → user
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, role: UserRole.COACH, isActive: true },
      select: { userId: true },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

    // Verify batch belongs to this org
    const batch = await this.prisma.batch.findFirst({
      where: { id: dto.batchId, venue: { organizationId } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    return this.prisma.batchCoach.upsert({
      where: { batchId_coachId: { batchId: dto.batchId, coachId: orgUser.userId } },
      create: { batchId: dto.batchId, coachId: orgUser.userId, isPrimary: dto.isPrimary ?? false },
      update: { isPrimary: dto.isPrimary ?? false },
      include: {
        batch: { select: { id: true, name: true } },
        coach: { select: { id: true, name: true } },
      },
    });
  }
}
