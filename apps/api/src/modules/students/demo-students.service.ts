import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, StudentStatus, DemoStudentStatus } from '@kheloge/database';

export interface CreateDemoStudentDto {
  name: string;
  phone?: string;
  sport?: string;
  batchId?: string;
  gender?: string;
  dob?: string;
  email?: string;
  demoStartDate?: string;
  demoEndDate?: string;
}

export interface UpdateDemoStudentDto {
  name?: string;
  phone?: string;
  sport?: string;
  batchId?: string;
  gender?: string;
  dob?: string;
  email?: string;
  demoStartDate?: string;
  demoEndDate?: string;
  convertedToRegular?: boolean;
  status?: DemoStudentStatus;
}

@Injectable()
export class DemoStudentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(venueId: string | undefined, orgId: string, opts: { search?: string } = {}) {
    const { search } = opts;
    return this.prisma.demoStudent.findMany({
      where: {
        organizationId: orgId,
        ...(venueId ? { venueId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: { batch: { include: { sport: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForOrg(orgId: string, opts: { search?: string } = {}) {
    const { search } = opts;
    return this.prisma.demoStudent.findMany({
      where: {
        organizationId: orgId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: { batch: { include: { sport: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCoach(coachUserId: string, orgId: string, opts: { search?: string } = {}) {
    const { search } = opts;
    const batchCoaches = await this.prisma.batchCoach.findMany({
      where: { coachId: coachUserId },
      select: { batchId: true },
    });
    const coachBatchIds = batchCoaches.map((bc) => bc.batchId);

    return this.prisma.demoStudent.findMany({
      where: {
        organizationId: orgId,
        batchId: { in: coachBatchIds },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: { batch: { include: { sport: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const demo = await this.prisma.demoStudent.findUnique({
      where: { id },
      include: { batch: { include: { sport: true } } },
    });
    if (!demo) throw new NotFoundException('Demo student not found');
    return demo;
  }

  async create(venueId: string | undefined, orgId: string, dto: CreateDemoStudentDto) {
    return this.prisma.demoStudent.create({
      data: {
        organizationId: orgId,
        venueId: venueId ?? null,
        name: dto.name,
        phone: dto.phone ?? null,
        sport: dto.sport ?? null,
        batchId: dto.batchId ?? null,
        gender: dto.gender ?? null,
        dob: dto.dob ? new Date(dto.dob) : null,
        email: dto.email ?? null,
        demoStartDate: dto.demoStartDate ? new Date(dto.demoStartDate) : null,
        demoEndDate: dto.demoEndDate ? new Date(dto.demoEndDate) : null,
      },
      include: { batch: { include: { sport: true } } },
    });
  }

  async update(id: string, dto: UpdateDemoStudentDto, actorRole: UserRole) {
    const demo = await this.prisma.demoStudent.findUnique({ where: { id } });
    if (!demo) throw new NotFoundException('Demo student not found');

    // Super admin may not mark conversions — that is coach's responsibility
    if (dto.convertedToRegular === true && actorRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin cannot convert demo students');
    }

    if (dto.convertedToRegular === true && !demo.convertedToRegular) {
      // Create a regular student and link
      const newStudent = await this.prisma.student.create({
        data: {
          organizationId: demo.organizationId,
          name: demo.name,
          phone: demo.phone ?? undefined,
          status: StudentStatus.ACTIVE,
          ...(demo.batchId
            ? {
                enrollments: {
                  create: { batchId: demo.batchId },
                },
              }
            : {}),
        },
      });

      return this.prisma.demoStudent.update({
        where: { id },
        data: {
          convertedToRegular: true,
          convertedStudentId: newStudent.id,
          convertedAt: new Date(),
        },
        include: { batch: { include: { sport: true } } },
      });
    }

    const { convertedToRegular, ...rest } = dto;
    return this.prisma.demoStudent.update({
      where: { id },
      data: {
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.phone !== undefined ? { phone: rest.phone } : {}),
        ...(rest.sport !== undefined ? { sport: rest.sport } : {}),
        ...(rest.batchId !== undefined ? { batchId: rest.batchId } : {}),
        ...(rest.gender !== undefined ? { gender: rest.gender } : {}),
        ...(rest.dob !== undefined ? { dob: rest.dob ? new Date(rest.dob) : null } : {}),
        ...(rest.email !== undefined ? { email: rest.email } : {}),
        ...(rest.demoStartDate !== undefined ? { demoStartDate: rest.demoStartDate ? new Date(rest.demoStartDate) : null } : {}),
        ...(rest.demoEndDate !== undefined ? { demoEndDate: rest.demoEndDate ? new Date(rest.demoEndDate) : null } : {}),
        ...(rest.status !== undefined ? { status: rest.status } : {}),
      },
      include: { batch: { include: { sport: true } } },
    });
  }
}
