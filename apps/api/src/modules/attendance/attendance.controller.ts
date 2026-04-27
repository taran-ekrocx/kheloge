import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AttendanceService, MarkAttendanceDto, QrCheckinDto, StartSessionDto } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Get('batches/:batchId')
  getForBatch(@Param('batchId') batchId: string, @Query('date') date: string) {
    return this.attendance.getForBatch(batchId, date || new Date().toISOString().split('T')[0]);
  }

  @Get('batches/:batchId/sessions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  getSessionsForBatch(@Param('batchId') batchId: string, @Query('date') date: string) {
    return this.attendance.getSessionsForBatch(batchId, date);
  }

  @Get('students/:studentId')
  getForStudent(
    @Param('studentId') studentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    return this.attendance.getForStudent(studentId, start, end);
  }

  @Get('students/:studentId/stats')
  getStudentStats(@Param('studentId') studentId: string, @Query('months') months: string) {
    return this.attendance.getStudentStats(studentId, months ? parseInt(months) : 3);
  }

  @Post('batches/:batchId/mark')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  async mark(@Param('batchId') batchId: string, @Body() dto: MarkAttendanceDto, @Request() req) {
    if (req.user.role === UserRole.COACH) {
      const hasAccess = await this.attendance.verifyCoachBatch(req.user.id, batchId);
      if (!hasAccess) throw new ForbiddenException('You are not assigned to this batch');
    }
    return this.attendance.mark(batchId, dto, req.user.id);
  }

  @Post('qr-checkin')
  qrCheckin(@Body() dto: QrCheckinDto) {
    return this.attendance.qrCheckin(dto);
  }

  @Post('batches/:batchId/auto-absent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  autoMarkAbsent(@Param('batchId') batchId: string) {
    return this.attendance.autoMarkAbsent(batchId);
  }

  @Post('sessions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  async startSession(@Body() dto: StartSessionDto, @Request() req) {
    if (req.user.role === UserRole.COACH) {
      const hasAccess = await this.attendance.verifyCoachBatch(req.user.id, dto.batchId);
      if (!hasAccess) throw new ForbiddenException('You are not assigned to this batch');
    }
    return this.attendance.startSession(dto.batchId, req.user.id);
  }

  @Get('sessions/:sessionId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  getSession(@Param('sessionId') sessionId: string) {
    return this.attendance.getSession(sessionId);
  }

  @Patch('sessions/:sessionId/end')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  endSession(@Param('sessionId') sessionId: string) {
    return this.attendance.endSession(sessionId);
  }
}
