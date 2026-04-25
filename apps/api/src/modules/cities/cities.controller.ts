import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CitiesService, CreateCityDto } from './cities.service';

@ApiTags('cities')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('cities')
export class CitiesController {
  constructor(private cities: CitiesService) {}

  @Get()
  findAll(@Request() req) {
    return this.cities.findAll(req.user.orgId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cities.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Request() req, @Body() dto: CreateCityDto) {
    return this.cities.create(req.user.orgId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER)
  update(@Param('id') id: string, @Body() dto: Partial<CreateCityDto>) {
    return this.cities.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  deactivate(@Param('id') id: string) {
    return this.cities.deactivate(id);
  }
}
