import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import type { Response } from 'express';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

const ANALYTICS_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.CITY_MANAGER,
  UserRole.VENUE_MANAGER,
  UserRole.ACCOUNTANT,
];

function defaultDateRange(monthsBack: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);
  return { from, to };
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('revenue')
  @Roles(...ANALYTICS_ROLES)
  getRevenue(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('venueId') venueId?: string,
  ) {
    const { from: defaultFrom, to: defaultTo } = defaultDateRange(6);
    return this.reports.getRevenue(
      req.tenantOrgId,
      from ? new Date(from) : defaultFrom,
      to ? new Date(to) : defaultTo,
      venueId,
    );
  }

  @Get('enrolments')
  @Roles(...ANALYTICS_ROLES)
  getEnrolments(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('venueId') venueId?: string,
  ) {
    const { from: defaultFrom, to: defaultTo } = defaultDateRange(12);
    return this.reports.getEnrolments(
      req.tenantOrgId,
      from ? new Date(from) : defaultFrom,
      to ? new Date(to) : defaultTo,
      venueId,
    );
  }

  @Get('attendance')
  @Roles(...ANALYTICS_ROLES, UserRole.COACH)
  getAttendance(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('batchId') batchId?: string,
    @Query('venueId') venueId?: string,
  ) {
    const { from: defaultFrom, to: defaultTo } = defaultDateRange(1);
    return this.reports.getAttendance(
      req.tenantOrgId,
      from ? new Date(from) : defaultFrom,
      to ? new Date(to) : defaultTo,
      batchId,
      venueId,
    );
  }

  @Get('export')
  @Roles(...ANALYTICS_ROLES)
  async exportCsv(
    @Request() req,
    @Res() res: Response,
    @Query('type') type: 'revenue' | 'enrolments' = 'revenue',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('venueId') venueId?: string,
  ) {
    const { from: defaultFrom, to: defaultTo } = defaultDateRange(6);
    const csv = await this.reports.exportCsv(
      req.tenantOrgId,
      type,
      from ? new Date(from) : defaultFrom,
      to ? new Date(to) : defaultTo,
      venueId,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  }
}
