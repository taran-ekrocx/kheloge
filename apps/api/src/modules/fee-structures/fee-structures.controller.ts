import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FeeStructuresService, CreateFeeStructureDto, UpdateFeeStructureDto } from './fee-structures.service';

@ApiTags('fee-structures')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('fee-structures')
export class FeeStructuresController {
  constructor(private feeStructures: FeeStructuresService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'batchId', required: false })
  @ApiQuery({ name: 'sportId', required: false })
  findAll(
    @Request() req,
    @Query('batchId') batchId?: string,
    @Query('sportId') sportId?: string,
  ) {
    return this.feeStructures.findAll(req.user.orgId, { batchId, sportId });
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  create(@Request() req, @Body() dto: CreateFeeStructureDto) {
    return this.feeStructures.create(req.user.orgId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateFeeStructureDto) {
    return this.feeStructures.update(req.user.orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  remove(@Request() req, @Param('id') id: string) {
    return this.feeStructures.remove(req.user.orgId, id);
  }
}
