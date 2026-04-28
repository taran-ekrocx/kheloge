import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { IsString, IsPhoneNumber } from 'class-validator';

class SendOtpDto {
  @IsString()
  phone: string;
}

class VerifyOtpDto {
  @IsString()
  phone: string;

  @IsString()
  otp: string;

  @IsString()
  orgSlug: string;
}

class DevLoginDto {
  @IsString()
  phone: string;

  @IsString()
  orgSlug: string;
}

class RefreshDto {
  @IsString()
  refreshToken: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Get('users-by-role')
  getUsersByRole(@Query('orgSlug') orgSlug: string) {
    return this.auth.getUsersByRole(orgSlug);
  }

  @Post('otp/send')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.otp, dto.orgSlug);
  }

  @Post('dev-login')
  devLogin(@Body() dto: DevLoginDto) {
    return this.auth.devLogin(dto.phone, dto.orgSlug);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshTokens(dto.refreshToken);
  }
}
