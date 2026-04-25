import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@kheloge/shared';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: {
        userId: payload.sub,
        organizationId: payload.orgId,
        isActive: true,
      },
      include: { user: true },
    });

    if (!orgUser) throw new UnauthorizedException();
    return { ...orgUser.user, role: payload.role, orgId: payload.orgId, venueId: payload.venueId };
  }
}
