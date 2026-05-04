import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, Query, ParseBoolPipe, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, StudentStatus } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CoachesService, AssignCoachDto, CreateCoachDto, UpdateCoachDto } from './coaches.service';
import { StudentsService, CreateStudentDto } from '../students/students.service';
import { IsArray, IsString } from 'class-validator';

class SyncBatchStudentsDto {
  @IsArray()
  @IsString({ each: true })
  studentIds: string[];
}


@ApiTags('coaches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('coaches')
export class CoachesController {
  constructor(
    private coaches: CoachesService,
    private students: StudentsService,
  ) {}

  @Get('me/kpi')
  @Roles(UserRole.COACH)
  myKpi(@Request() req) {
    return this.coaches.getCoachKpiDashboard(req.user.id);
  }

  @Get('me/batches')
  @Roles(UserRole.COACH)
  myBatches(@Request() req, @Query('status') status?: string) {
    return this.coaches.getCoachBatches(req.user.id, status);
  }

  @Patch('me/batches/:id')
  @Roles(UserRole.COACH)
  updateMyBatch(@Request() req, @Param('id') batchId: string, @Body('isActive', ParseBoolPipe) isActive: boolean) {
    return this.coaches.updateCoachBatchStatus(req.user.id, batchId, isActive);
  }

  @Patch('me/batches/:id/students')
  @Roles(UserRole.COACH)
  syncBatchStudents(@Request() req, @Param('id') batchId: string, @Body() dto: SyncBatchStudentsDto) {
    return this.coaches.syncCoachBatchStudents(req.user.id, batchId, dto.studentIds);
  }

  @Get('me/org-students')
  @Roles(UserRole.COACH)
  orgStudents(@Request() req, @Query('status') status?: StudentStatus | 'all') {
    return this.students.findAllForOrg(req.user.orgId, { status: status ?? 'ACTIVE' as any });
  }

  @Post('me/students')
  @Roles(UserRole.COACH)
  addStudent(@Request() req, @Body() dto: CreateStudentDto) {
    return this.students.create(undefined, req.user.orgId, dto);
  }

  @Patch('me/students/:id')
  @Roles(UserRole.COACH)
  updateStudent(@Request() req, @Param('id') studentId: string, @Body() dto: Partial<CreateStudentDto>) {
    return this.coaches.updateCoachStudent(req.user.id, studentId, dto);
  }

  @Post('me/students/:id/enrol')
  @Roles(UserRole.COACH)
  enrollStudent(@Request() req, @Param('id') studentId: string, @Body('batchId') batchId: string) {
    return this.coaches.enrollCoachStudent(req.user.id, studentId, batchId);
  }

  @Delete('me/students/:id/enroll/:batchId')
  @Roles(UserRole.COACH)
  unenrollStudent(@Request() req, @Param('id') studentId: string, @Param('batchId') batchId: string) {
    return this.coaches.unenrollCoachStudent(req.user.id, studentId, batchId);
  }

  @Get('me/earnings')
  @Roles(UserRole.COACH)
  myEarnings(
    @Request() req,
    @Query('month') month?: string,
    @Query('venueId') venueId?: string,
    @Query('sportId') sportId?: string,
    @Query('batchId') batchId?: string,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.coaches.getCoachEarnings(req.user.id, m, { venueId, sportId, batchId });
  }

  @Get('me/payments')
  @Roles(UserRole.COACH)
  myPayments(
    @Request() req,
    @Query('month') month?: string,
    @Query('frequency') frequency?: string,
    @Query('period') period?: string,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.coaches.getCoachPaymentSummary(req.user.id, m, frequency, period);
  }

  @Post('me/payments/mark-paid')
  @Roles(UserRole.COACH)
  markStudentPaid(
    @Request() req,
    @Body('studentId') studentId: string,
    @Body('invoiceId') invoiceId?: string,
    @Body('amount') amount?: number,
  ) {
    if (!studentId) throw new BadRequestException('studentId is required');
    return this.coaches.markCoachStudentPaid(req.user.id, studentId, invoiceId, amount);
  }

  @Get('me/students')
  @Roles(UserRole.COACH)
  myStudents(
    @Request() req,
    @Query('search') search?: string,
    @Query('status') status?: StudentStatus | 'all',
    @Query('sportId') sportId?: string,
    @Query('batchId') batchId?: string,
  ) {
    return this.students.findByCoach(req.user.id, { search, status, sportId, batchId });
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  findAll(@Request() req, @Query('status') status?: string) {
    return this.coaches.findAll(req.user.orgId, status);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  create(@Request() req, @Body() dto: CreateCoachDto) {
    return this.coaches.createCoachGlobal(req.user.orgId, dto);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  findOne(@Request() req, @Param('id') id: string) {
    return this.coaches.findOne(req.user.orgId, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateCoachDto) {
    return this.coaches.updateCoachGlobal(req.user.orgId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  remove(@Request() req, @Param('id') id: string) {
    return this.coaches.removeCoachGlobal(req.user.orgId, id);
  }

  @Post(':id/assignments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  assignToBatch(@Request() req, @Param('id') id: string, @Body() dto: AssignCoachDto) {
    return this.coaches.assignToBatch(req.user.orgId, id, dto);
  }
}
