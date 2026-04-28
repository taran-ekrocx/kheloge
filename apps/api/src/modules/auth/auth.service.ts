import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { OtpService } from './otp.service';
import { JwtPayload, AuthTokens, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } from '@kheloge/shared';
import { normalizePhone } from '../../common/utils/phone';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private otp: OtpService,
  ) {}

  async sendOtp(phone: string): Promise<{ message: string }> {
    phone = normalizePhone(phone);
    const code = await this.otp.generate(phone);
    // TODO: send via MSG91 / Gupshup
    // For dev, log it
    if (this.config.get('NODE_ENV') !== 'production') {
      console.log(`OTP for ${phone}: ${code}`);
    }
    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, code: string, orgSlug: string): Promise<AuthTokens> {
    phone = normalizePhone(phone);
    const valid = await this.otp.verify(phone, code);
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP');

    // Find or create user
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone, name: phone } });
    }

    // Find org membership
    const org = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new BadRequestException('Organization not found');

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organizationId: org.id, isActive: true },
    });
    if (!orgUser) throw new UnauthorizedException('Not a member of this organization');

    return this.generateTokens({
      sub: user.id,
      orgId: org.id,
      role: orgUser.role,
      venueId: orgUser.venueId || undefined,
      cityId: orgUser.cityId || undefined,
    });
  }

  async devLogin(phone: string, orgSlug: string): Promise<AuthTokens> {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new UnauthorizedException('Not available in production');
    }

    phone = normalizePhone(phone);
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone, name: phone } });
    }

    const org = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new BadRequestException('Organization not found');

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organizationId: org.id, isActive: true },
    });
    if (!orgUser) throw new UnauthorizedException('Not a member of this organization');

    return this.generateTokens({
      sub: user.id,
      orgId: org.id,
      role: orgUser.role,
      venueId: orgUser.venueId || undefined,
      cityId: orgUser.cityId || undefined,
    });
  }

  async getUsersByRole(orgSlug: string): Promise<Record<string, Array<{ name: string; phone: string }>>> {
    const org = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new BadRequestException('Organization not found');

    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId: org.id, isActive: true },
      include: {
        user: { select: { name: true, phone: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    const grouped: Record<string, Array<{ name: string; phone: string }>> = {};
    for (const ou of orgUsers) {
      if (!grouped[ou.role]) grouped[ou.role] = [];
      grouped[ou.role].push({ name: ou.user.name, phone: ou.user.phone });
    }

    return grouped;
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      return this.generateTokens(payload);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(payload: JwtPayload): AuthTokens {
    const { iat, exp, ...cleanPayload } = payload;
    return {
      accessToken: this.jwt.sign(cleanPayload, { expiresIn: ACCESS_TOKEN_EXPIRY }),
      refreshToken: this.jwt.sign(cleanPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_EXPIRY,
      }),
    };
  }
}
