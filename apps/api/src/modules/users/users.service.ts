import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@kheloge/database';

export interface InviteUserDto {
  phone: string;
  name: string;
  role: UserRole;
  venueId?: string;
  cityId?: string;
}

export interface UpdateUserRoleDto {
  role: UserRole;
  venueId?: string;
  cityId?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.organizationUser.findMany({
      where: { organizationId, isActive: true },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, photoUrl: true } },
        venue: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, orgUserId: string) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId },
      include: {
        user: true,
        venue: true,
        city: true,
      },
    });
    if (!orgUser) throw new NotFoundException('User not found');
    return orgUser;
  }

  async invite(organizationId: string, dto: InviteUserDto) {
    // Find or create the user by phone
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone: dto.phone, name: dto.name } });
    } else {
      // Update name if provided
      await this.prisma.user.update({ where: { id: user.id }, data: { name: dto.name } });
    }

    // Check for existing active membership
    const existing = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organizationId, isActive: true },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    return this.prisma.organizationUser.create({
      data: {
        userId: user.id,
        organizationId,
        role: dto.role,
        venueId: dto.venueId ?? null,
        cityId: dto.cityId ?? null,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        venue: { select: { id: true, name: true } },
      },
    });
  }

  async updateRole(organizationId: string, orgUserId: string, dto: UpdateUserRoleDto) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId },
    });
    if (!orgUser) throw new NotFoundException('User not found');

    return this.prisma.organizationUser.update({
      where: { id: orgUserId },
      data: {
        role: dto.role,
        venueId: dto.venueId ?? null,
        cityId: dto.cityId ?? null,
      },
    });
  }

  async remove(organizationId: string, orgUserId: string) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: orgUserId, organizationId },
    });
    if (!orgUser) throw new NotFoundException('User not found');

    return this.prisma.organizationUser.update({
      where: { id: orgUserId },
      data: { isActive: false },
    });
  }
}
