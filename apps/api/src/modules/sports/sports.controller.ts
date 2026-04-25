import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SportsService, CreateSportDto } from './sports.service';

@ApiTags('sports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('sports')
export class SportsController {
  constructor(private sports: SportsService) {}

  @Get()
  findAll(@Request() req) {
    return this.sports.findAll(req.user.orgId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sports.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Request() req, @Body() dto: CreateSportDto) {
    return this.sports.create(req.user.orgId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateSportDto>) {
    return this.sports.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  deactivate(@Param('id') id: string) {
    return this.sports.deactivate(id);
  }

  // Assign sport to venue
  @Post('venues/:venueId/sports/:sportId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  assignToVenue(@Param('venueId') venueId: string, @Param('sportId') sportId: string) {
    return this.sports.assignToVenue(venueId, sportId);
  }

  // Remove sport from venue
  @Delete('venues/:venueId/sports/:sportId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  removeFromVenue(@Param('venueId') venueId: string, @Param('sportId') sportId: string) {
    return this.sports.removeFromVenue(venueId, sportId);
  }
}
