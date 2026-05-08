import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsArray, IsEnum, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, BatchDay } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VenuesService } from './venues.service';
import { CoachesService, CreateCoachDto, UpdateCoachDto } from '../coaches/coaches.service';
import { BatchesService } from '../batches/batches.service';

// ── Venue-scoped batch DTOs (matches the frontend payload shape) ────────────

class CreateVenueBatchDto {
  @IsString() name: string;
  @IsString() sportId: string;
  @IsOptional() @IsArray() coachIds?: string[];
  @IsOptional() @IsArray() studentIds?: string[];
  @IsOptional() @IsArray() demoStudentIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) capacity?: number;
  @IsOptional() @IsNumber() @Type(() => Number) fee?: number;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsArray() @IsEnum(BatchDay, { each: true }) days: BatchDay[];
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

class UpdateVenueBatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sportId?: string;
  @IsOptional() @IsArray() coachIds?: string[];
  @IsOptional() @IsArray() studentIds?: string[];
  @IsOptional() @IsArray() demoStudentIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) capacity?: number;
  @IsOptional() @IsNumber() @Type(() => Number) fee?: number;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsArray() @IsEnum(BatchDay, { each: true }) days?: BatchDay[];
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

function mapBatch(b: any) {
  return {
    ...b,
    coaches: b.coaches?.map((bc: any) => bc.coach) ?? [],
    fee: b.fee ?? null,
    status: b.isActive === false ? 'INACTIVE' : 'ACTIVE',
  };
}

@ApiTags('venues')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('venues')
export class VenuesController {
  constructor(
    private venues: VenuesService,
    private coaches: CoachesService,
    private batchesSvc: BatchesService,
  ) {}

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
  listCoaches(@Request() req, @Param('venueId') venueId: string, @Query('status') status?: string) {
    return this.coaches.findByVenue(req.user.orgId, venueId, status);
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

  // ── Batches sub-resource ─────────────────────────────────────────────────

  @Get(':venueId/batches')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  async listBatches(@Request() req, @Param('venueId') venueId: string) {
    const effectiveCoachId = req.user.role === UserRole.COACH ? req.user.id : undefined;
    const batches = await this.batchesSvc.findAll(req.user.orgId, { venueId, coachId: effectiveCoachId, status: 'active' });
    return batches.map(mapBatch);
  }

  @Post(':venueId/batches')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  async createBatch(
    @Request() req,
    @Param('venueId') venueId: string,
    @Body() dto: CreateVenueBatchDto,
  ) {
    const { coachIds, studentIds, demoStudentIds, fee, status, ...rest } = dto;
    const isActive = status !== 'INACTIVE';
    const batch = await this.batchesSvc.create({ ...rest, venueId, feeAmount: fee, isActive, studentIds });
    if (coachIds?.length) {
      await this.batchesSvc.reassignCoaches(batch.id, coachIds);
    }
    if (demoStudentIds !== undefined) {
      await this.batchesSvc.syncDemoStudents(batch.id, demoStudentIds);
    }
    const created = await this.batchesSvc.findOne(batch.id);
    return mapBatch(created);
  }

  @Patch(':venueId/batches/:batchId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  async updateBatch(
    @Param('batchId') batchId: string,
    @Body() dto: UpdateVenueBatchDto,
  ) {
    const { coachIds, studentIds, demoStudentIds, fee, status, sportId, ...rest } = dto;
    const isActive = status !== undefined ? status !== 'INACTIVE' : undefined;
    await this.batchesSvc.update(batchId, {
      ...rest,
      ...(sportId ? { sportId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(fee !== undefined ? { fee } : {}),
    });
    if (coachIds !== undefined) {
      await this.batchesSvc.reassignCoaches(batchId, coachIds);
    }
    if (studentIds !== undefined) {
      await this.batchesSvc.syncEnrollments(batchId, studentIds);
    }
    if (demoStudentIds !== undefined) {
      await this.batchesSvc.syncDemoStudents(batchId, demoStudentIds);
    }
    const batch = await this.batchesSvc.findOne(batchId);
    return mapBatch(batch);
  }

  @Delete(':venueId/batches/:batchId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  async removeBatch(@Param('batchId') batchId: string) {
    return this.batchesSvc.remove(batchId);
  }
}
