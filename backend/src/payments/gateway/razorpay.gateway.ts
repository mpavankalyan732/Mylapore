import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutInput, CheckoutResult, GatewayEvent, PaymentGateway } from './gateway.interface';
import { header, verifyHmacHex } from './hmac';

/**
 * Razorpay hosted checkout via Payment Links (https://razorpay.com/docs/api/payments/payment-links/).
 * Webhook: header X-Razorpay-Signature = hex HMAC-SHA256(rawBody, webhookSecret); X-Razorpay-Event-Id is unique per event.
 * Configure the webhook for: payment_link.paid, payment_link.expired, payment_link.cancelled.
 */
@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay';
  constructor(private readonly config: ConfigService) {}

  async createCheckout(i: CheckoutInput): Promise<CheckoutResult> {
    const id = this.config.get<string>('RAZORPAY_KEY_ID');
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!id || !secret) throw new BadGatewayException('Razorpay credentials not configured');
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: i.amountPaise,
        currency: 'INR',
        reference_id: i.orderNumber,
        description: `Order ${i.orderNumber}`,
        customer: { name: i.customerName, contact: `+91${i.customerPhone}` },
        notify: { sms: false, email: false },
        callback_url: i.returnUrl,
        callback_method: 'get',
        expire_by: Math.max(Math.floor(i.expiresAt.getTime() / 1000), Math.floor(Date.now() / 1000) + 16 * 60),
        notes: { orderId: i.orderId },
      }),
    });
    if (!res.ok) throw new BadGatewayException(`Razorpay error ${res.status}`);
    const j = (await res.json()) as { id: string; short_url: string };
    return { reference: j.id, checkoutUrl: j.short_url };
  }

  verifySignature(raw: Buffer, headers: Record<string, string | string[] | undefined>) {
    return verifyHmacHex(this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '', raw, header(headers, 'x-razorpay-signature'));
  }

  parseEvent(raw: Buffer, headers: Record<string, string | string[] | undefined>): GatewayEvent {
    const body = JSON.parse(raw.toString('utf8'));
    const link = body?.payload?.payment_link?.entity;
    const eventId = header(headers, 'x-razorpay-event-id') ?? '';
    const base = { eventId, reference: link?.id ?? '', amountPaise: Number(link?.amount ?? 0) };
    switch (body?.event) {
      case 'payment_link.paid':
        return { ...base, type: 'PAID', gatewayPaymentId: body?.payload?.payment?.entity?.id };
      case 'payment_link.expired':
      case 'payment_link.cancelled':
        return { ...base, type: 'EXPIRED' };
      default:
        // payment.failed is ignored on purpose: the customer can retry on the same link until it expires.
        return { ...base, type: 'IGNORED' };
    }
  }
}
