import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutInput, CheckoutResult, GatewayEvent, PaymentGateway, PaymentLinkStatus, QrInput, QrResult } from './gateway.interface';
import { header, verifyHmacHex } from './hmac';

/**
 * Razorpay hosted checkout via Payment Links (https://razorpay.com/docs/api/payments/payment-links/).
 * Webhook: header X-Razorpay-Signature = hex HMAC-SHA256(rawBody, webhookSecret); X-Razorpay-Event-Id is unique per event.
 * Configure the webhook for: payment_link.paid, payment_link.expired, payment_link.cancelled, qr_code.credited.
 */
@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay';
  constructor(private readonly config: ConfigService) {}

  get configured() {
    // The key pair is what creates a payment link. The webhook secret is optional: without it, payment is confirmed by
    // reconciling with Razorpay while the customer's order page polls (see the status endpoint), so it must not block checkout.
    return !!this.config.get<string>('RAZORPAY_KEY_ID') && !!this.config.get<string>('RAZORPAY_KEY_SECRET');
  }

  /** Fetch the authoritative Payment Link state from Razorpay (server-to-server). */
  async fetchPaymentLink(reference: string): Promise<PaymentLinkStatus> {
    const id = this.config.get<string>('RAZORPAY_KEY_ID');
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!id || !secret) throw new BadGatewayException('Razorpay credentials not configured');
    const res = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(reference)}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new BadGatewayException(`Razorpay status error ${res.status}`);
    const link = (await res.json()) as {
      id: string; status: string; amount_paid?: number;
      payments?: { payment_id?: string; status?: string }[];
    };
    return {
      status: link.status,
      amountPaid: Number(link.amount_paid ?? 0),
      paymentId: link.payments?.find((payment) => payment.status === 'captured')?.payment_id,
    };
  }

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

  /** Single-use fixed-amount UPI QR (https://razorpay.com/docs/api/qr-codes/). Paid = webhook qr_code.credited. */
  async createQr(i: QrInput): Promise<QrResult> {
    const id = this.config.get<string>('RAZORPAY_KEY_ID');
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!id || !secret) throw new BadGatewayException('Razorpay credentials not configured');
    const res = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      },
      body: JSON.stringify({
        type: 'upi_qr',
        name: `Order ${i.orderNumber}`,
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: i.amountPaise,
        description: `Order ${i.orderNumber}`,
        // Razorpay requires close_by to be at least 2 minutes ahead.
        close_by: Math.max(Math.floor(i.expiresAt.getTime() / 1000), Math.floor(Date.now() / 1000) + 130),
        notes: { orderNumber: i.orderNumber },
      }),
    });
    if (!res.ok) throw new BadGatewayException(`Razorpay error ${res.status}`);
    const j = (await res.json()) as { id: string; image_url: string };
    return { reference: j.id, qrImageUrl: j.image_url };
  }

  verifySignature(raw: Buffer, headers: Record<string, string | string[] | undefined>) {
    return verifyHmacHex(this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '', raw, header(headers, 'x-razorpay-signature'));
  }

  parseEvent(raw: Buffer, headers: Record<string, string | string[] | undefined>): GatewayEvent {
    const body = JSON.parse(raw.toString('utf8'));
    const link = body?.payload?.payment_link?.entity;
    const qr = body?.payload?.qr_code?.entity;
    const eventId = header(headers, 'x-razorpay-event-id') ?? '';
    const base = { eventId, reference: link?.id ?? '', amountPaise: Number(link?.amount ?? 0) };
    if (body?.event === 'qr_code.credited') {
      // The amount comes from the payment that was actually credited, not from the QR we created.
      const pay = body?.payload?.payment?.entity;
      return { eventId, type: 'PAID', reference: qr?.id ?? '', amountPaise: Number(pay?.amount ?? 0), gatewayPaymentId: pay?.id };
    }
    // qr_code.closed is ignored on purpose: a single-use QR also closes right after it is paid and the two
    // events can arrive in either order. Expiry is derived from our own deadline instead (see paymentStatus).
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
