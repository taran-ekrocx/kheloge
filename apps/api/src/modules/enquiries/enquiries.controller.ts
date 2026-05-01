import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, EnquiryStage } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EnquiriesService, CreateEnquiryDto } from './enquiries.service';

@ApiTags('enquiries')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('venues/:venueId/enquiries')
export class EnquiriesController {
  constructor(private enquiries: EnquiriesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  findAll(@Param('venueId') venueId: string, @Query('stage') stage?: EnquiryStage) {
    return this.enquiries.findAll(venueId, stage);
  }

  @Get('dashboard')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  getDashboard(@Param('venueId') venueId: string) {
    return this.enquiries.getDashboard(venueId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  create(@Param('venueId') venueId: string, @Body() dto: CreateEnquiryDto) {
    return this.enquiries.create(venueId, dto);
  }

  @Patch(':id/stage')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  updateStage(@Param('id') id: string, @Body('stage') stage: EnquiryStage) {
    return this.enquiries.updateStage(id, stage);
  }

  @Post(':id/comments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  addComment(@Param('id') id: string, @Body('body') body: string, @Request() req) {
    return this.enquiries.addComment(id, req.user.id, body);
  }

  @Post(':id/convert')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  convert(@Param('id') id: string, @Body('batchId') batchId: string) {
    return this.enquiries.convertToStudent(id, batchId);
  }
}
