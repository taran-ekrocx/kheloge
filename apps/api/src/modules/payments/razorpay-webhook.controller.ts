import { Controller, Post, Req, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { PaymentMode } from '@kheloge/database';

/**
 * Public webhook endpoint for Razorpay payment events.
 * No JWT guard — Razorpay calls this server-to-server.
 * Signature is verified with the webhook secret (set in Razorpay dashboard).
 * Requires rawBody: true in NestFactory.create options so HMAC is computed
 * on the original wire bytes, not re-serialised JSON.
 */
@ApiTags('webhooks')
@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  private readonly logger = new Logger('RazorpayWebhook');

  constructor(
    private payments: PaymentsService,
    private config: ConfigService,
  ) {}

  @Post()
  async handle(@Req() req: RawBodyRequest<FastifyRequest>) {
    // ── 1. Signature verification ─────────────────────────────────────────
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!signature) {
      throw new UnauthorizedException('Missing x-razorpay-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      this.logger.warn('Webhook signature mismatch — rejecting');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // ── 2. Dispatch event ─────────────────────────────────────────────────
    const payload = JSON.parse(rawBody.toString('utf8'));
    const event: string = payload.event;

    if (event === 'payment.captured') {
      await this.handlePaymentCaptured(payload.payload.payment.entity);
    } else if (event === 'payment.failed') {
      await this.handlePaymentFailed(payload.payload.payment.entity);
    } else {
      this.logger.log(`Unhandled Razorpay event: ${event}`);
    }

    return { received: true };
  }

  private async handlePaymentCaptured(payment: any) {
    const invoiceId = payment.notes?.invoiceId;
    if (!invoiceId) {
      this.logger.warn(`payment.captured: no invoiceId in notes for payment ${payment.id}`);
      return;
    }

    // ── Idempotency: skip if this Razorpay payment was already recorded ───
    const existing = await this.payments.findPaymentByReference(payment.id);
    if (existing) {
      this.logger.log(`payment.captured: payment ${payment.id} already recorded — skipping`);
      return;
    }

    this.logger.log(`payment.captured: invoiceId=${invoiceId}, paymentId=${payment.id}`);

    await this.payments.recordPayment({
      studentId: payment.notes.studentId,
      invoiceId,
      amount: payment.amount / 100,
      mode: PaymentMode.ONLINE,
      referenceNumber: payment.id,
      notes: `Razorpay auto-capture: ${payment.id}`,
    });
  }

  private async handlePaymentFailed(payment: any) {
    this.logger.warn(`payment.failed: id=${payment.id}, reason=${payment.error_reason}`);
    // TODO: send notification to admin/student about failed payment
  }
}
