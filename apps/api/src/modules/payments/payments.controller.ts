import { Controller, Get, Post, Patch, Param, Body, UseGuards, Res, RawBodyRequest, Req, Headers } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole, PaymentMode } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsService, RecordPaymentDto, CreateInvoiceDto, CreateFeePlanDto, UpdateFeePlanDto } from './payments.service';
import { ReceiptService } from './receipt.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private receipts: ReceiptService,
    private invoicePdf: InvoicePdfService,
  ) {}

  @Get('dashboard/:venueId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  getDashboard(@Param('venueId') venueId: string) {
    return this.payments.getDashboard(venueId);
  }

  @Get('venues/:venueId/kpi')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  getKpiDashboard(@Param('venueId') venueId: string) {
    return this.payments.getKpiDashboard(venueId);
  }

  @Get('venues/:venueId/fee-plans')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  getVenueFeePlans(@Param('venueId') venueId: string) {
    return this.payments.getVenueFeePlans(venueId);
  }

  @Post('venues/:venueId/fee-plans')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  createFeePlan(@Param('venueId') venueId: string, @Body() dto: CreateFeePlanDto) {
    return this.payments.createFeePlan(venueId, dto);
  }

  @Patch('fee-plans/:feePlanId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  updateFeePlan(@Param('feePlanId') feePlanId: string, @Body() dto: UpdateFeePlanDto) {
    return this.payments.updateFeePlan(feePlanId, dto);
  }

  @Get('venues/:venueId/invoices')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  getVenueInvoices(@Param('venueId') venueId: string) {
    return this.payments.getVenueInvoices(venueId);
  }

  @Post('invoices/:invoiceId/mark-paid')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  markInvoicePaid(@Param('invoiceId') invoiceId: string, @Body() body: { mode?: PaymentMode }) {
    return this.payments.markInvoicePaid(invoiceId, body.mode);
  }

  @Post('venues/:venueId/fee-reminders/dispatch')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  dispatchFeeReminders(@Param('venueId') venueId: string) {
    return this.payments.dispatchFeeReminders(venueId);
  }

  @Get('students/:studentId/invoices')
  getInvoices(@Param('studentId') studentId: string) {
    return this.payments.getStudentInvoices(studentId);
  }

  @Post('invoices')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.payments.createInvoice(dto);
  }

  @Post('record')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  recordPayment(@Body() dto: RecordPaymentDto) {
    return this.payments.recordPayment(dto);
  }

  @Post('razorpay/order/:invoiceId')
  createOrder(@Param('invoiceId') invoiceId: string) {
    return this.payments.createRazorpayOrder(invoiceId);
  }

  @Post('razorpay/verify')
  verifyPayment(@Body() body: { invoiceId: string; orderId: string; paymentId: string; signature: string }) {
    return this.payments.verifyRazorpayPayment(body.invoiceId, body.orderId, body.paymentId, body.signature);
  }

  @Get(':paymentId/receipt')
  async downloadReceipt(@Param('paymentId') paymentId: string, @Res() reply: FastifyReply) {
    const pdf = await this.receipts.generateReceipt(paymentId);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="receipt-${paymentId}.pdf"`)
      .send(pdf);
  }

  @Get('invoices/:invoiceId/pdf')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.ACCOUNTANT)
  async downloadInvoicePdf(@Param('invoiceId') invoiceId: string, @Res() reply: FastifyReply) {
    const pdf = await this.invoicePdf.generateInvoicePdf(invoiceId);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`)
      .send(pdf);
  }
}
