import { Controller, Get, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentMode, PaymentStatus } from '@kheloge/database';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InvoicesHttpService } from './invoices-http.service';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesHttp: InvoicesHttpService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'batchId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string for dueDate range start' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string for dueDate range end' })
  findAll(
    @Request() req,
    @Query('status') status?: PaymentStatus,
    @Query('studentId') studentId?: string,
    @Query('batchId') batchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.invoicesHttp.findAll(req.user.orgId, { status, studentId, batchId, from, to });
  }

  @Patch(':id/mark-paid')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  markPaid(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { mode?: PaymentMode },
  ) {
    return this.invoicesHttp.markPaid(req.user.orgId, id, body.mode);
  }
}
