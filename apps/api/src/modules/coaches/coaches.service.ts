import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { CreateStudentDto } from '../students/students.service';
import { IsString, IsOptional, IsBoolean, IsEmail, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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

export class EducationDetailDto {
  @ApiPropertyOptional() @IsOptional() @IsString() qualification?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() institute?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() year?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sportsCertifications?: string;
}

export class CoachingExperienceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() organization?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() duration?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibilities?: string;
}

export class CoachProfileDto {
  @ApiPropertyOptional({ type: [EducationDetailDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDetailDto)
  educationDetails?: EducationDetailDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() sportSpecialization?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  playingLevels?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() achievements?: string;

  @ApiPropertyOptional({ type: [CoachingExperienceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoachingExperienceDto)
  coachingExperience?: CoachingExperienceDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keySkills?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() expectedSalary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() joiningAvailability?: string;
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sportIds?: string[];

  @ApiPropertyOptional({ type: CoachProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoachProfileDto)
  profile?: CoachProfileDto;
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sportIds?: string[];

  @ApiPropertyOptional({ type: CoachProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoachProfileDto)
  profile?: CoachProfileDto;
}

const VENUE_COACH_INCLUDE = {
  user: {
    select: {
      id: true, name: true, phone: true, email: true, photoUrl: true,
      coachSports: { include: { sport: { select: { id: true, name: true, icon: true } } } },
      coachBatches: { include: { batch: { select: { id: true, name: true, sport: { select: { id: true, name: true } } } } } },
    },
  },
  venue: { select: { id: true, name: true } },
  coachProfile: true,
};

@Injectable()
export class CoachesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId, role: UserRole.COACH, isActive: true },
      include: VENUE_COACH_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orgUsers.map((ou) => this.mapOrgUser(ou));
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
    const { user, venue, isActive, locationCity, coachProfile, ...rest } = orgUser;
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
      sports: (user.coachSports ?? []).map((cs: any) => cs.sport),
      batches: (user.coachBatches ?? []).map((bc: any) => ({
        batchId: bc.batchId,
        isPrimary: bc.isPrimary,
        ...bc.batch,
      })),
      profile: coachProfile ?? null,
    };
  }

  async findByVenue(organizationId: string, venueId: string) {
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId, venueId, role: UserRole.COACH, isActive: true },
      include: VENUE_COACH_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return orgUsers.map((ou) => this.mapOrgUser(ou));
  }

  async createCoach(organizationId: string, venueId: string, dto: CreateCoachDto) {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, organizationId },
    });
    if (!venue) throw new NotFoundException('Venue not found');

    dto.phone = normalizePhone(dto.phone);
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
      include: VENUE_COACH_INCLUDE,
    });

    if (dto.sportIds && dto.sportIds.length > 0) {
      await this.prisma.coachSport.createMany({
        data: dto.sportIds.map((sportId) => ({ coachId: user.id, sportId })),
        skipDuplicates: true,
      });
    }

    if (dto.profile) {
      await this.prisma.coachProfile.create({
        data: {
          orgUserId: orgUser.id,
          educationDetails: (dto.profile.educationDetails ?? []) as any,
          sportSpecialization: dto.profile.sportSpecialization,
          playingLevels: dto.profile.playingLevels ?? [],
          achievements: dto.profile.achievements,
          coachingExperience: (dto.profile.coachingExperience ?? []) as any,
          keySkills: dto.profile.keySkills ?? [],
          responsibilities: dto.profile.responsibilities ?? [],
          expectedSalary: dto.profile.expectedSalary,
          joiningAvailability: dto.profile.joiningAvailability,
        },
      });
    }

    const refreshed = await this.prisma.organizationUser.findFirst({
      where: { id: orgUser.id },
      include: VENUE_COACH_INCLUDE,
    });
    return this.mapOrgUser(refreshed);
  }

  async updateCoach(organizationId: string, venueId: string, orgUserId: string, dto: UpdateCoachDto) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, venueId, role: UserRole.COACH },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

    const userUpdate: any = {};
    if (dto.name !== undefined) userUpdate.name = dto.name;
    if (dto.phone !== undefined) userUpdate.phone = normalizePhone(dto.phone);
    if (dto.email !== undefined) userUpdate.email = dto.email;
    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({ where: { id: orgUser.userId }, data: userUpdate });
    }

    const orgUserUpdate: any = {};
    if (dto.status !== undefined) orgUserUpdate.isActive = dto.status === 'ACTIVE';
    if (dto.state !== undefined) orgUserUpdate.state = dto.state;
    if (dto.district !== undefined) orgUserUpdate.district = dto.district;
    if (dto.city !== undefined) orgUserUpdate.locationCity = dto.city;
    if (dto.region !== undefined) orgUserUpdate.region = dto.region;
    if (Object.keys(orgUserUpdate).length > 0) {
      await this.prisma.organizationUser.update({ where: { id: orgUserId }, data: orgUserUpdate });
    }

    if (dto.sportIds !== undefined) {
      await this.prisma.coachSport.deleteMany({ where: { coachId: orgUser.userId } });
      if (dto.sportIds.length > 0) {
        await this.prisma.coachSport.createMany({
          data: dto.sportIds.map((sportId) => ({ coachId: orgUser.userId, sportId })),
          skipDuplicates: true,
        });
      }
    }

    if (dto.profile !== undefined) {
      await this.prisma.coachProfile.upsert({
        where: { orgUserId },
        create: {
          orgUserId,
          educationDetails: (dto.profile.educationDetails ?? []) as any,
          sportSpecialization: dto.profile.sportSpecialization,
          playingLevels: dto.profile.playingLevels ?? [],
          achievements: dto.profile.achievements,
          coachingExperience: (dto.profile.coachingExperience ?? []) as any,
          keySkills: dto.profile.keySkills ?? [],
          responsibilities: dto.profile.responsibilities ?? [],
          expectedSalary: dto.profile.expectedSalary,
          joiningAvailability: dto.profile.joiningAvailability,
        },
        update: {
          ...(dto.profile.educationDetails !== undefined ? { educationDetails: dto.profile.educationDetails as any } : {}),
          ...(dto.profile.sportSpecialization !== undefined ? { sportSpecialization: dto.profile.sportSpecialization } : {}),
          ...(dto.profile.playingLevels !== undefined ? { playingLevels: dto.profile.playingLevels } : {}),
          ...(dto.profile.achievements !== undefined ? { achievements: dto.profile.achievements } : {}),
          ...(dto.profile.coachingExperience !== undefined ? { coachingExperience: dto.profile.coachingExperience as any } : {}),
          ...(dto.profile.keySkills !== undefined ? { keySkills: dto.profile.keySkills } : {}),
          ...(dto.profile.responsibilities !== undefined ? { responsibilities: dto.profile.responsibilities } : {}),
          ...(dto.profile.expectedSalary !== undefined ? { expectedSalary: dto.profile.expectedSalary } : {}),
          ...(dto.profile.joiningAvailability !== undefined ? { joiningAvailability: dto.profile.joiningAvailability } : {}),
        },
      });
    }

    const updated = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId },
      include: VENUE_COACH_INCLUDE,
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

  async createCoachGlobal(organizationId: string, dto: CreateCoachDto) {
    dto.phone = normalizePhone(dto.phone);
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

    const existing = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organizationId, venueId: null, role: UserRole.COACH, isActive: true },
    });
    if (existing) throw new ConflictException('Coach already exists in this organization');

    const isActive = dto.status !== 'INACTIVE';
    const orgUser = await this.prisma.organizationUser.create({
      data: {
        userId: user.id,
        organizationId,
        role: UserRole.COACH,
        isActive,
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.district !== undefined ? { district: dto.district } : {}),
        ...(dto.city !== undefined ? { locationCity: dto.city } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
      },
      include: VENUE_COACH_INCLUDE,
    });

    if (dto.sportIds && dto.sportIds.length > 0) {
      await this.prisma.coachSport.createMany({
        data: dto.sportIds.map((sportId) => ({ coachId: user.id, sportId })),
        skipDuplicates: true,
      });
    }

    if (dto.profile) {
      await this.prisma.coachProfile.create({
        data: {
          orgUserId: orgUser.id,
          educationDetails: (dto.profile.educationDetails ?? []) as any,
          sportSpecialization: dto.profile.sportSpecialization,
          playingLevels: dto.profile.playingLevels ?? [],
          achievements: dto.profile.achievements,
          coachingExperience: (dto.profile.coachingExperience ?? []) as any,
          keySkills: dto.profile.keySkills ?? [],
          responsibilities: dto.profile.responsibilities ?? [],
          expectedSalary: dto.profile.expectedSalary,
          joiningAvailability: dto.profile.joiningAvailability,
        },
      });
    }

    const refreshed = await this.prisma.organizationUser.findFirst({
      where: { id: orgUser.id },
      include: VENUE_COACH_INCLUDE,
    });
    return this.mapOrgUser(refreshed);
  }

  async updateCoachGlobal(organizationId: string, orgUserId: string, dto: UpdateCoachDto) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, role: UserRole.COACH },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

    const userUpdate: any = {};
    if (dto.name !== undefined) userUpdate.name = dto.name;
    if (dto.phone !== undefined) userUpdate.phone = normalizePhone(dto.phone);
    if (dto.email !== undefined) userUpdate.email = dto.email;
    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({ where: { id: orgUser.userId }, data: userUpdate });
    }

    const orgUserUpdate: any = {};
    if (dto.status !== undefined) orgUserUpdate.isActive = dto.status === 'ACTIVE';
    if (dto.state !== undefined) orgUserUpdate.state = dto.state;
    if (dto.district !== undefined) orgUserUpdate.district = dto.district;
    if (dto.city !== undefined) orgUserUpdate.locationCity = dto.city;
    if (dto.region !== undefined) orgUserUpdate.region = dto.region;
    if (Object.keys(orgUserUpdate).length > 0) {
      await this.prisma.organizationUser.update({ where: { id: orgUserId }, data: orgUserUpdate });
    }

    if (dto.sportIds !== undefined) {
      await this.prisma.coachSport.deleteMany({ where: { coachId: orgUser.userId } });
      if (dto.sportIds.length > 0) {
        await this.prisma.coachSport.createMany({
          data: dto.sportIds.map((sportId) => ({ coachId: orgUser.userId, sportId })),
          skipDuplicates: true,
        });
      }
    }

    if (dto.profile !== undefined) {
      await this.prisma.coachProfile.upsert({
        where: { orgUserId },
        create: {
          orgUserId,
          educationDetails: (dto.profile.educationDetails ?? []) as any,
          sportSpecialization: dto.profile.sportSpecialization,
          playingLevels: dto.profile.playingLevels ?? [],
          achievements: dto.profile.achievements,
          coachingExperience: (dto.profile.coachingExperience ?? []) as any,
          keySkills: dto.profile.keySkills ?? [],
          responsibilities: dto.profile.responsibilities ?? [],
          expectedSalary: dto.profile.expectedSalary,
          joiningAvailability: dto.profile.joiningAvailability,
        },
        update: {
          ...(dto.profile.educationDetails !== undefined ? { educationDetails: dto.profile.educationDetails as any } : {}),
          ...(dto.profile.sportSpecialization !== undefined ? { sportSpecialization: dto.profile.sportSpecialization } : {}),
          ...(dto.profile.playingLevels !== undefined ? { playingLevels: dto.profile.playingLevels } : {}),
          ...(dto.profile.achievements !== undefined ? { achievements: dto.profile.achievements } : {}),
          ...(dto.profile.coachingExperience !== undefined ? { coachingExperience: dto.profile.coachingExperience as any } : {}),
          ...(dto.profile.keySkills !== undefined ? { keySkills: dto.profile.keySkills } : {}),
          ...(dto.profile.responsibilities !== undefined ? { responsibilities: dto.profile.responsibilities } : {}),
          ...(dto.profile.expectedSalary !== undefined ? { expectedSalary: dto.profile.expectedSalary } : {}),
          ...(dto.profile.joiningAvailability !== undefined ? { joiningAvailability: dto.profile.joiningAvailability } : {}),
        },
      });
    }

    const updated = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId },
      include: VENUE_COACH_INCLUDE,
    });
    return this.mapOrgUser(updated);
  }

  async removeCoachGlobal(organizationId: string, orgUserId: string) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, role: UserRole.COACH },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

    await this.prisma.organizationUser.update({
      where: { id: orgUserId },
      data: { isActive: false },
    });

    return { success: true };
  }

  async assignToBatch(organizationId: string, orgUserId: string, dto: AssignCoachDto) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId, role: UserRole.COACH, isActive: true },
      select: { userId: true },
    });
    if (!orgUser) throw new NotFoundException('Coach not found');

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

  async updateCoachStudent(coachUserId: string, studentId: string, dto: Partial<CreateStudentDto>) {
    const coachBatches = await this.prisma.batchCoach.findMany({
      where: { coachId: coachUserId },
      select: { batchId: true },
    });
    const batchIds = coachBatches.map((bc) => bc.batchId);
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { studentId, batchId: { in: batchIds }, isActive: true },
    });
    if (!enrolled) throw new NotFoundException('Student not found in your batches');
    const { guardians, dob, cityId, batchIds: _batchIds, ...rest } = dto as any;
    return this.prisma.student.update({
      where: { id: studentId },
      data: { ...rest, ...(dob ? { dob: new Date(dob) } : {}) },
    });
  }

  async getCoachBatches(coachUserId: string) {
    const batchCoaches = await this.prisma.batchCoach.findMany({
      where: { coachId: coachUserId },
      include: {
        batch: {
          include: { sport: { select: { id: true, name: true } } },
        },
      },
    });
    return batchCoaches.map((bc) => ({
      id: bc.batch.id,
      name: bc.batch.name,
      sportId: bc.batch.sportId,
      sport: bc.batch.sport,
    }));
  }

  async getCoachKpiDashboard(coachId: string) {
    const coachBatches = await this.prisma.batchCoach.findMany({
      where: { coachId },
      select: { batchId: true },
    });
    const batchIds = coachBatches.map((bc) => bc.batchId);

    const [activeBatches, totalStudents, recentEnrollments] = await Promise.all([
      this.prisma.batch.count({ where: { id: { in: batchIds }, isActive: true } }),
      this.prisma.enrollment.groupBy({
        by: ['studentId'],
        where: { batchId: { in: batchIds }, isActive: true },
      }).then((rows) => rows.length),
      this.prisma.enrollment.findMany({
        where: { batchId: { in: batchIds } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          student: { select: { name: true } },
          batch: { select: { name: true, sport: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      totalStudents,
      activeBatches,
      monthlyRevenue: 0,
      pendingFees: 0,
      recentEnrollments: recentEnrollments.map((e) => ({
        id: e.id,
        studentName: e.student.name,
        batchName: e.batch.name,
        sportName: e.batch.sport.name,
        createdAt: e.createdAt,
        type: 'enrollment' as const,
      })),
      recentPayments: [],
    };
  }
}
