import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VenuesService } from './venues.service';
import { CoachesService, CreateCoachDto, UpdateCoachDto } from '../coaches/coaches.service';

@ApiTags('venues')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('venues')
export class VenuesController {
  constructor(private venues: VenuesService, private coaches: CoachesService) {}

  @Get()
  findAll(@Request() req) {
    return this.venues.findAll(req.user.orgId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venues.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER)
  create(@Request() req, @Body() body: any) {
    return this.venues.create(req.user.orgId, body);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  update(@Param('id') id: string, @Body() body: any) {
    return this.venues.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER)
  deactivate(@Param('id') id: string) {
    return this.venues.deactivate(id);
  }

  // ── Coaches sub-resource ─────────────────────────────────────────────────

  @Get(':venueId/coaches')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  listCoaches(@Request() req, @Param('venueId') venueId: string) {
    return this.coaches.findByVenue(req.user.orgId, venueId);
  }

  @Post(':venueId/coaches')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  createCoach(@Request() req, @Param('venueId') venueId: string, @Body() dto: CreateCoachDto) {
    return this.coaches.createCoach(req.user.orgId, venueId, dto);
  }

  @Patch(':venueId/coaches/:coachId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  updateCoach(
    @Request() req,
    @Param('venueId') venueId: string,
    @Param('coachId') coachId: string,
    @Body() dto: UpdateCoachDto,
  ) {
    return this.coaches.updateCoach(req.user.orgId, venueId, coachId, dto);
  }

  @Delete(':venueId/coaches/:coachId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  removeCoach(
    @Request() req,
    @Param('venueId') venueId: string,
    @Param('coachId') coachId: string,
  ) {
    return this.coaches.removeCoach(req.user.orgId, venueId, coachId);
  }
}
