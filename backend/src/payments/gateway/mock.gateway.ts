import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { CheckoutInput, CheckoutResult, GatewayEvent, PaymentGateway } from './gateway.interface';
import { header, verifyHmacHex } from './hmac';

/** Local/demo gateway. Uses the SAME signed-webhook path as a real provider. Disabled in production. */
@Injectable()
export class MockGateway implements PaymentGateway {
  readonly name = 'mock';
  constructor(private readonly config: ConfigService) {}

  async createCheckout(i: CheckoutInput): Promise<CheckoutResult> {
    const reference = `mock_${randomUUID()}`;
    const base = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return { reference, checkoutUrl: `${base}/pay/mock?ref=${reference}&order=${i.orderNumber}` };
  }

  verifySignature(raw: Buffer, headers: Record<string, string | string[] | undefined>) {
    return verifyHmacHex(this.config.get<string>('MOCK_WEBHOOK_SECRET') ?? '', raw, header(headers, 'x-mock-signature'));
  }

  parseEvent(raw: Buffer): GatewayEvent {
    const b = JSON.parse(raw.toString('utf8'));
    const type = b.event === 'payment.paid' ? 'PAID' : b.event === 'payment.failed' ? 'FAILED' : 'IGNORED';
    return { eventId: String(b.id), type, reference: String(b.reference), amountPaise: Number(b.amount), gatewayPaymentId: b.paymentId };
  }
}
