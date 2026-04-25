import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BatchesService, CreateBatchDto, UpdateBatchDto } from './batches.service';

@ApiTags('batches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('batches')
export class BatchesController {
  constructor(private batches: BatchesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  @ApiQuery({ name: 'sportId', required: false })
  @ApiQuery({ name: 'venueId', required: false })
  @ApiQuery({ name: 'coachId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  findAll(
    @Request() req,
    @Query('sportId') sportId?: string,
    @Query('venueId') venueId?: string,
    @Query('coachId') coachId?: string,
    @Query('status') status?: 'active' | 'inactive',
  ) {
    return this.batches.findAll(req.user.orgId, { sportId, venueId, coachId, status });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  findOne(@Param('id') id: string) {
    return this.batches.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  create(@Body() dto: CreateBatchDto) {
    return this.batches.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.batches.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  remove(@Param('id') id: string) {
    return this.batches.remove(id);
  }
}
