import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { PrismaService } from '../../database/prisma.service';

export class AssignCoachDto {
  @ApiProperty({ description: 'Batch ID to assign the coach to' })
  @IsString()
  batchId: string;

  @ApiPropertyOptional({ description: 'Whether this coach is the primary coach for the batch' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
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
