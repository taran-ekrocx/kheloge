import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CoachesService, AssignCoachDto } from './coaches.service';

@ApiTags('coaches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('coaches')
export class CoachesController {
  constructor(private coaches: CoachesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  findAll(@Request() req) {
    return this.coaches.findAll(req.user.orgId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  findOne(@Request() req, @Param('id') id: string) {
    return this.coaches.findOne(req.user.orgId, id);
  }

  @Post(':id/assignments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  assignToBatch(@Request() req, @Param('id') id: string, @Body() dto: AssignCoachDto) {
    return this.coaches.assignToBatch(req.user.orgId, id, dto);
  }
}
