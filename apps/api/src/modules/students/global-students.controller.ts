import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, StudentStatus } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StudentsService, CreateStudentDto } from './students.service';

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
  @Roles(UserRole.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.students.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Request() req, @Body() dto: CreateStudentDto) {
    return this.students.create(undefined, req.user.orgId, dto);
  }
}
