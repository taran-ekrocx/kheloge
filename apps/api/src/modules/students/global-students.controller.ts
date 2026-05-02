import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, StudentStatus } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StudentsService, CreateStudentDto, EnrollStudentDto } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('students')
export class GlobalStudentsController {
  constructor(private students: StudentsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(
    @Request() req,
    @Query('search') search?: string,
    @Query('status') status?: StudentStatus | 'all',
    @Query('sportId') sportId?: string,
    @Query('batchId') batchId?: string,
  ) {
    return this.students.findAllForOrg(req.user.orgId, { search, status, sportId, batchId });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  findOne(@Param('id') id: string) {
    return this.students.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Request() req, @Body() dto: CreateStudentDto) {
    return this.students.create(undefined, req.user.orgId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateStudentDto>) {
    return this.students.update(id, dto);
  }

  @Post(':id/enrol')
  @Roles(UserRole.SUPER_ADMIN)
  enrol(@Param('id') id: string, @Body() dto: EnrollStudentDto) {
    return this.students.enroll(id, dto);
  }

  @Delete(':id/enroll/:batchId')
  @Roles(UserRole.SUPER_ADMIN)
  unenroll(@Param('id') id: string, @Param('batchId') batchId: string) {
    return this.students.unenroll(id, batchId);
  }
}
