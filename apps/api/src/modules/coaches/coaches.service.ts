import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { CreateStudentDto } from '../students/students.service';
import { IsString, IsOptional, IsBoolean, IsEmail, IsIn, IsArray, ValidateNested, IsNumber } from 'class-validator';
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
  @ApiPropertyOptional() @IsOptional() @IsString() paymentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() paymentValue?: number;
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

  async findAll(organizationId: string, status?: string) {
    const isActive = status === 'ACTIVE' ? true : status === 'INACTIVE' ? false : undefined;
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId, role: UserRole.COACH, ...(isActive !== undefined ? { isActive } : {}) },
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

  async findByVenue(organizationId: string, venueId: string, status?: string) {
    const isActive = status === 'ACTIVE' ? true : status === 'INACTIVE' ? false : undefined;
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId, venueId, role: UserRole.COACH, ...(isActive !== undefined ? { isActive } : {}) },
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
          paymentType: dto.profile.paymentType,
          paymentValue: dto.profile.paymentValue,
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
          paymentType: dto.profile.paymentType,
          paymentValue: dto.profile.paymentValue,
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
          ...(dto.profile.paymentType !== undefined ? { paymentType: dto.profile.paymentType } : {}),
          ...(dto.profile.paymentValue !== undefined ? { paymentValue: dto.profile.paymentValue } : {}),
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
          paymentType: dto.profile.paymentType,
          paymentValue: dto.profile.paymentValue,
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
          paymentType: dto.profile.paymentType,
          paymentValue: dto.profile.paymentValue,
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
          ...(dto.profile.paymentType !== undefined ? { paymentType: dto.profile.paymentType } : {}),
          ...(dto.profile.paymentValue !== undefined ? { paymentValue: dto.profile.paymentValue } : {}),
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

  async enrollCoachStudent(coachUserId: string, studentId: string, batchId: string) {
    const assigned = await this.prisma.batchCoach.findFirst({ where: { coachId: coachUserId, batchId } });
    if (!assigned) throw new NotFoundException('Batch not found in your assignments');
    const batch = await this.prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
    const enrollmentCount = await this.prisma.enrollment.count({ where: { batchId, isActive: true } });
    if (enrollmentCount >= batch.capacity) throw new Error('Batch is at full capacity');
    return this.prisma.enrollment.upsert({
      where: { studentId_batchId: { studentId, batchId } },
      create: { studentId, batchId },
      update: { isActive: true, leftAt: null },
    });
  }

  async unenrollCoachStudent(coachUserId: string, studentId: string, batchId: string) {
    const assigned = await this.prisma.batchCoach.findFirst({ where: { coachId: coachUserId, batchId } });
    if (!assigned) throw new NotFoundException('Batch not found in your assignments');
    return this.prisma.enrollment.update({
      where: { studentId_batchId: { studentId, batchId } },
      data: { isActive: false, leftAt: new Date() },
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

  async getCoachBatches(coachUserId: string, status?: string) {
    const isActive = status === 'active' ? true : undefined;
    const batchCoaches = await this.prisma.batchCoach.findMany({
      where: { coachId: coachUserId, ...(isActive !== undefined ? { batch: { isActive } } : {}) },
      include: {
        batch: {
          include: {
            sport: { select: { id: true, name: true } },
            venue: { select: { id: true, name: true } },
            _count: { select: { enrollments: { where: { isActive: true } } } },
          },
        },
      },
    });
    return batchCoaches.map((bc) => ({
      ...bc.batch,
      sport: bc.batch.sport,
      venue: bc.batch.venue,
      _count: bc.batch._count,
      status: bc.batch.isActive === false ? 'INACTIVE' : 'ACTIVE',
    }));
  }

  async updateCoachBatchStatus(coachUserId: string, batchId: string, isActive: boolean) {
    const assigned = await this.prisma.batchCoach.findFirst({
      where: { coachId: coachUserId, batchId },
    });
    if (!assigned) throw new NotFoundException('Batch not found in your assignments');
    return this.prisma.batch.update({ where: { id: batchId }, data: { isActive } });
  }

  async syncCoachBatchStudents(coachUserId: string, batchId: string, studentIds: string[]) {
    const assigned = await this.prisma.batchCoach.findFirst({ where: { coachId: coachUserId, batchId } });
    if (!assigned) throw new NotFoundException('Batch not found in your assignments');

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

  private getPeriodDateRange(frequency: string, period: string): { start: Date; end: Date } | null {
    if (frequency === 'ONE_TIME' || !period) return null;

    if (frequency === 'MONTHLY') {
      const [year, mon] = period.split('-').map(Number);
      return { start: new Date(year, mon - 1, 1), end: new Date(year, mon, 1) };
    }

    if (frequency === 'QUARTERLY') {
      const [yearStr, qStr] = period.split('-');
      const year = Number(yearStr);
      const q = Number(qStr.slice(1));
      return { start: new Date(year, (q - 1) * 3, 1), end: new Date(year, q * 3, 1) };
    }

    if (frequency === 'HALF_YEARLY') {
      const [yearStr, hStr] = period.split('-');
      const year = Number(yearStr);
      const h = Number(hStr.slice(1));
      return { start: new Date(year, (h - 1) * 6, 1), end: new Date(year, h * 6, 1) };
    }

    if (frequency === 'ANNUAL') {
      const year = Number(period);
      return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
    }

    return null;
  }

  async getCoachPaymentSummary(coachId: string, month: string, frequency?: string, period?: string, batchId?: string) {
    const effectiveFrequency = frequency ?? 'MONTHLY';
    const effectivePeriod = period ?? month;
    const dateRange = this.getPeriodDateRange(effectiveFrequency, effectivePeriod);

    const batchCoaches = await this.prisma.batchCoach.findMany({
      where: { coachId, ...(batchId ? { batchId } : {}) },
      include: {
        batch: {
          include: {
            sport: { select: { id: true, name: true } },
            venue: { select: { id: true, name: true } },
            feePlans: {
              where: { isActive: true, frequency: effectiveFrequency as any },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            enrollments: {
              where: { isActive: true },
              include: { student: { select: { id: true, name: true, phone: true } } },
            },
          },
        },
      },
    });

    const filteredBatchCoaches = batchCoaches.filter((bc) => bc.batch.feePlans.length > 0);
    const feePlanIds = filteredBatchCoaches.flatMap((bc) => bc.batch.feePlans.map((fp) => fp.id));
    const studentIds = filteredBatchCoaches.flatMap((bc) => bc.batch.enrollments.map((e) => e.student.id));

    const [invoices, payments] = await Promise.all([
      feePlanIds.length > 0 ? this.prisma.invoice.findMany({
        where: {
          studentId: { in: studentIds },
          feePlanId: { in: feePlanIds },
          ...(dateRange ? { dueDate: { gte: dateRange.start, lt: dateRange.end } } : {}),
        },
        select: { id: true, studentId: true, feePlanId: true, amount: true, status: true },
      }) : [],
      studentIds.length > 0 ? this.prisma.payment.findMany({
        where: {
          studentId: { in: studentIds },
          ...(dateRange ? { paidAt: { gte: dateRange.start, lt: dateRange.end } } : {}),
          status: 'PAID' as any,
        },
        select: { id: true, studentId: true, invoiceId: true, amount: true },
        orderBy: { paidAt: 'desc' },
      }) : [],
    ]);

    const invoiceMap = new Map(invoices.map((inv) => [`${inv.studentId}:${inv.feePlanId}`, inv]));
    // Keep only the most recent payment per student for the month
    const paymentMap = new Map<string, typeof payments[0]>();
    for (const p of payments) {
      if (!paymentMap.has(p.studentId)) paymentMap.set(p.studentId, p);
    }

    const batches = filteredBatchCoaches.map((bc) => {
      const batch = bc.batch;
      const feePlan = batch.feePlans[0];
      const defaultAmount = feePlan ? Number(feePlan.amount) : 0;

      const students = batch.enrollments.map((enrollment) => {
        const student = enrollment.student;
        const invoice = feePlan ? invoiceMap.get(`${student.id}:${feePlan.id}`) : undefined;
        const payment = paymentMap.get(student.id);
        const isPaid = invoice?.status === 'PAID' || (!invoice && !!payment);
        return {
          id: student.id,
          name: student.name,
          phone: student.phone,
          invoiceId: invoice?.id ?? null,
          status: isPaid ? 'PAID' : 'PENDING',
          amount: invoice ? Number(invoice.amount) : (payment ? Number(payment.amount) : defaultAmount),
        };
      });

      const collected = students.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amount, 0);
      const pending = students.filter((s) => s.status !== 'PAID').reduce((sum, s) => sum + s.amount, 0);

      return {
        id: batch.id,
        name: batch.name,
        sport: batch.sport,
        venue: batch.venue,
        feePlanId: feePlan?.id ?? null,
        fee: defaultAmount,
        students,
        summary: {
          collected,
          pending,
          paidCount: students.filter((s) => s.status === 'PAID').length,
          pendingCount: students.filter((s) => s.status !== 'PAID').length,
        },
      };
    });

    const totalCollected = batches.reduce((sum, b) => sum + b.summary.collected, 0);
    const totalPending = batches.reduce((sum, b) => sum + b.summary.pending, 0);
    const paidStudents = batches.reduce((sum, b) => sum + b.summary.paidCount, 0);
    const pendingStudents = batches.reduce((sum, b) => sum + b.summary.pendingCount, 0);

    return { summary: { totalCollected, totalPending, paidStudents, pendingStudents }, batches };
  }

  async markCoachStudentPaid(coachId: string, studentId: string, invoiceId?: string, amount?: number) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, batch: { coaches: { some: { coachId } } }, isActive: true },
    });
    if (!enrollment) throw new NotFoundException('Student not found in your batches');

    const receiptNumber = `RCP-${Date.now()}`;
    const payment = await this.prisma.payment.create({
      data: {
        studentId,
        invoiceId: invoiceId ?? undefined,
        amount: amount ?? 0,
        mode: 'CASH' as any,
        receiptNumber,
        paidAt: new Date(),
        status: 'PAID' as any,
      },
    });

    if (invoiceId) {
      await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID' as any } });
    }

    return payment;
  }

  async getCoachEarnings(coachId: string, month: string, filters: { venueId?: string; sportId?: string; batchId?: string }) {
    const [year, mon] = month.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 1);

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: coachId, role: UserRole.COACH },
      include: { coachProfile: true },
    });
    const paymentType = orgUser?.coachProfile?.paymentType ?? 'FIXED_PAYMENT';
    const paymentValue = Number(orgUser?.coachProfile?.paymentValue ?? 0);

    const batchCoaches = await this.prisma.batchCoach.findMany({
      where: {
        coachId,
        ...(filters.batchId ? { batchId: filters.batchId } : {}),
      },
      include: {
        batch: {
          include: {
            sport: { select: { id: true, name: true } },
            venue: { select: { id: true, name: true } },
            enrollments: { where: { isActive: true }, select: { studentId: true } },
          },
        },
      },
    });

    const filtered = batchCoaches.filter((bc) => {
      if (filters.venueId && bc.batch.venueId !== filters.venueId) return false;
      if (filters.sportId && bc.batch.sportId !== filters.sportId) return false;
      return true;
    });

    const batches = await Promise.all(
      filtered.map(async (bc) => {
        const batch = bc.batch;
        const studentCount = batch.enrollments.length;
        const code = batch.id.slice(0, 8).toUpperCase();
        const base = { id: batch.id, code, name: batch.name, venue: batch.venue, sport: batch.sport, studentCount };

        if (paymentType === 'REVENUE_PERCENTAGE') {
          const studentIds = batch.enrollments.map((e) => e.studentId);
          const agg = studentIds.length > 0
            ? await this.prisma.payment.aggregate({
                where: { studentId: { in: studentIds }, paidAt: { gte: monthStart, lt: monthEnd }, status: 'PAID' as any },
                _sum: { amount: true },
              })
            : { _sum: { amount: 0 } };
          const totalRevenue = Number(agg._sum.amount ?? 0);
          const commission = Math.round((totalRevenue * paymentValue) / 100);
          return { ...base, totalRevenue, commission, totalPayment: commission };
        }

        if (paymentType === 'PER_SESSION_PAYOUT') {
          const sessionCount = await this.prisma.attendanceSession.count({
            where: { batchId: batch.id, coachId, date: { gte: monthStart, lt: monthEnd } },
          });
          return { ...base, sessionCount, perSessionAmount: paymentValue, totalPayment: sessionCount * paymentValue };
        }

        // FIXED_PAYMENT (default)
        return { ...base, monthlyPayout: paymentValue, totalPayment: paymentValue };
      }),
    );

    const totalEarnings = batches.reduce((sum, b) => sum + b.totalPayment, 0);
    return { paymentType, paymentValue, totalEarnings, batches };
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
