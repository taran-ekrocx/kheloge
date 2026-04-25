import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { PaymentsService } from './payments.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

const WEBHOOK_SECRET = 'test-webhook-secret';

function makeSignature(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function makeRequest(body: object, overrides: Partial<{ secret: string; signature: string; noRawBody: boolean }> = {}) {
  const bodyStr = JSON.stringify(body);
  const sig =
    overrides.signature ??
    makeSignature(overrides.secret ?? WEBHOOK_SECRET, bodyStr);
  return {
    headers: { 'x-razorpay-signature': sig },
    rawBody: overrides.noRawBody ? undefined : Buffer.from(bodyStr),
  } as any;
}

const capturedPayload = (paymentId = 'pay_test123') => ({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: paymentId,
        amount: 50000, // paise
        notes: { invoiceId: 'inv_1', studentId: 'stu_1' },
      },
    },
  },
});

const failedPayload = (paymentId = 'pay_failed1') => ({
  event: 'payment.failed',
  payload: {
    payment: {
      entity: {
        id: paymentId,
        error_reason: 'payment_declined',
      },
    },
  },
});

describe('RazorpayWebhookController', () => {
  let controller: RazorpayWebhookController;
  let paymentsService: jest.Mocked<PaymentsService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RazorpayWebhookController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            findPaymentByReference: jest.fn().mockResolvedValue(null),
            recordPayment: jest.fn().mockResolvedValue({ id: 'rec_1' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(WEBHOOK_SECRET),
          },
        },
      ],
    }).compile();

    controller = module.get<RazorpayWebhookController>(RazorpayWebhookController);
    paymentsService = module.get(PaymentsService);
    configService = module.get(ConfigService);
  });

  // ── Signature verification ──────────────────────────────────────────────

  it('rejects when RAZORPAY_WEBHOOK_SECRET is not configured', async () => {
    configService.get.mockReturnValue(undefined);
    const req = makeRequest(capturedPayload());
    await expect(controller.handle(req)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when x-razorpay-signature header is missing', async () => {
    const req = makeRequest(capturedPayload());
    req.headers['x-razorpay-signature'] = undefined;
    await expect(controller.handle(req)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when signature does not match (tampered body)', async () => {
    const req = makeRequest(capturedPayload(), { signature: 'deadbeef' });
    await expect(controller.handle(req)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when rawBody is absent', async () => {
    const req = makeRequest(capturedPayload(), { noRawBody: true });
    await expect(controller.handle(req)).rejects.toThrow(BadRequestException);
  });

  it('accepts a valid signature and returns { received: true }', async () => {
    const req = makeRequest(capturedPayload());
    const result = await controller.handle(req);
    expect(result).toEqual({ received: true });
  });

  // ── payment.captured ────────────────────────────────────────────────────

  it('records a new payment on payment.captured', async () => {
    const req = makeRequest(capturedPayload('pay_new1'));
    await controller.handle(req);
    expect(paymentsService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceNumber: 'pay_new1',
        amount: 500, // 50000 paise → 500 rupees
        invoiceId: 'inv_1',
        studentId: 'stu_1',
      }),
    );
  });

  it('skips duplicate payment.captured (idempotency)', async () => {
    paymentsService.findPaymentByReference.mockResolvedValue({ id: 'existing_rec' } as any);
    const req = makeRequest(capturedPayload('pay_dup1'));
    await controller.handle(req);
    expect(paymentsService.recordPayment).not.toHaveBeenCalled();
  });

  it('skips payment.captured when invoiceId is absent in notes', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_noinv', amount: 10000, notes: {} },
        },
      },
    };
    const req = makeRequest(payload);
    await controller.handle(req);
    expect(paymentsService.recordPayment).not.toHaveBeenCalled();
  });

  // ── payment.failed ──────────────────────────────────────────────────────

  it('handles payment.failed without recording a payment', async () => {
    const req = makeRequest(failedPayload('pay_fail1'));
    const result = await controller.handle(req);
    expect(result).toEqual({ received: true });
    expect(paymentsService.recordPayment).not.toHaveBeenCalled();
  });

  // ── unknown events ──────────────────────────────────────────────────────

  it('acknowledges unknown events without processing them', async () => {
    const payload = { event: 'order.paid', payload: {} };
    const req = makeRequest(payload);
    const result = await controller.handle(req);
    expect(result).toEqual({ received: true });
    expect(paymentsService.recordPayment).not.toHaveBeenCalled();
  });
});
