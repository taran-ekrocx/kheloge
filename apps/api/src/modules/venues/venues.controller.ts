import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VenuesService } from './venues.service';

@ApiTags('venues')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('venues')
export class VenuesController {
  constructor(private venues: VenuesService) {}

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
}
