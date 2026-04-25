import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AttendanceService, MarkAttendanceDto, QrCheckinDto } from './attendance.service';

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
  mark(@Param('batchId') batchId: string, @Body() dto: MarkAttendanceDto, @Request() req) {
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
}
