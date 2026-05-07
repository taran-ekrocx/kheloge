import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DemoStudentsService, CreateDemoStudentDto, UpdateDemoStudentDto } from './demo-students.service';

@ApiTags('demo-students')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('venues/:venueId/demo-students')
export class DemoStudentsController {
  constructor(private demoStudents: DemoStudentsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  findAll(
    @Request() req,
    @Param('venueId') venueId: string,
    @Query('search') search?: string,
  ) {
    if (req.user.role === UserRole.COACH) {
      return this.demoStudents.findByCoach(req.user.id, req.user.orgId, { search });
    }
    return this.demoStudents.findAll(venueId, req.user.orgId, { search });
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  create(
    @Param('venueId') venueId: string,
    @Body() dto: CreateDemoStudentDto,
    @Request() req,
  ) {
    return this.demoStudents.create(venueId, req.user.orgId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDemoStudentDto,
    @Request() req,
  ) {
    return this.demoStudents.update(id, dto, req.user.role);
  }
}

@ApiTags('demo-students')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('demo-students')
export class GlobalDemoStudentsController {
  constructor(private demoStudents: DemoStudentsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Request() req, @Query('search') search?: string) {
    return this.demoStudents.findAllForOrg(req.user.orgId, { search });
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Request() req, @Body() dto: CreateDemoStudentDto) {
    return this.demoStudents.create(undefined, req.user.orgId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDemoStudentDto, @Request() req) {
    return this.demoStudents.update(id, dto, req.user.role);
  }
}
