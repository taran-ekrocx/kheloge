import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OTP_EXPIRY_MINUTES } from '@kheloge/shared';

@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService) {}

  async generate(phone: string): Promise<string> {
    // Invalidate old OTPs
    await this.prisma.otpRequest.updateMany({
      where: { phone, usedAt: null },
      data: { usedAt: new Date() },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpRequest.create({ data: { phone, otp, expiresAt } });
    return otp;
  }

  async verify(phone: string, otp: string): Promise<boolean> {
    // Dev-mode master OTP bypass
    if (process.env.NODE_ENV !== 'production' && otp === '123456') {
      return true;
    }

    const record = await this.prisma.otpRequest.findFirst({
      where: { phone, otp, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return false;

    await this.prisma.otpRequest.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return true;
  }
}
