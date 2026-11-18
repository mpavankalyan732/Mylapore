import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RealtimeGateway } from '../kitchen/realtime.gateway';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway } from './gateway/gateway.interface';
import { hmacHex } from './gateway/hmac';
import { MockGateway } from './gateway/mock.gateway';
import { RazorpayGateway } from './gateway/razorpay.gateway';
import { isTrustedCheckoutUrl } from './url-allowlist';

type Headers = Record<string, string | string[] | undefined>;

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PaymentsService.name);
  private readonly gateways: Record<string, PaymentGateway>;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly realtime: RealtimeGateway,
    razorpay: RazorpayGateway,
    mock: MockGateway,
  ) {
    this.gateways = { razorpay, mock };
  }

  private get activeProvider() {
    return this.config.get<string>('PAYMENT_PROVIDER') ?? 'mock';
  }
  private get isProd() {
    return this.config.get('NODE_ENV') === 'production';
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.expireStale(), 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------------------------------------------------------------- checkout creation

  /**
   * Create (or reuse) a hosted checkout for a PENDING_PAYMENT order.
   * The returned URL is validated against trusted hosts before it is stored or returned.
   */
  async ensureCheckout(orderId: string): Promise<{ checkoutUrl: string; expiresAt: Date | null }> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true } });
    if (order.status !== 'PENDING_PAYMENT') throw new ForbiddenException('Order is not awaiting payment');

    const existing = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PENDING', method: { not: 'UPI_QR' }, checkoutUrl: { not: null }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.checkoutUrl) return { checkoutUrl: existing.checkoutUrl, expiresAt: existing.expiresAt };

    const activeQr = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PENDING', method: 'UPI_QR', qrImageUrl: { not: null }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (activeQr) throw new ConflictException('A UPI QR payment is already in progress. Complete it or cancel the order first.');

    const gw = this.gateways[this.activeProvider];
    if (!gw) throw new BadGatewayException('Payment provider not configured');
    if (this.isProd && gw.name === 'mock') throw new BadGatewayException('Online payments are not configured for production.');
    const expiryMin = Number(this.config.get('PAYMENT_PENDING_EXPIRY_MINUTES') ?? 30);
    const expiresAt = new Date(Date.now() + expiryMin * 60_000);
    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    let result;
    try {
      result = await gw.createCheckout({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountPaise: order.totalPaise,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        returnUrl: `${frontend}/order/${order.orderNumber}?t=${order.lookupToken}&from=checkout`,
        expiresAt,
      });
    } catch (e) {
      this.log.error(`Checkout creation failed for ${order.orderNumber}: ${(e as Error).message}`);
      throw new BadGatewayException('Could not start online payment. Please try again.');
    }

    if (!isTrustedCheckoutUrl(result.checkoutUrl, this.trustedHosts(gw.name), !this.isProd)) {
      this.log.error(`Rejected untrusted checkout URL for ${order.orderNumber}`);
      throw new BadGatewayException('Payment provider returned an untrusted checkout URL');
    }

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: gw.name,
        reference: result.reference,
        amountPaise: order.totalPaise,
        method: 'CARD',
        checkoutUrl: result.checkoutUrl,
        expiresAt,
      },
    });
    return { checkoutUrl: result.checkoutUrl, expiresAt };
  }

  /** Hosts a returned checkout/QR URL must belong to. */
  private trustedHosts(gwName: string) {
    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const hosts = (this.config.get<string>('TRUSTED_CHECKOUT_HOSTS') ?? '').split(',');
    if (gwName === 'mock') hosts.push(new URL(frontend).hostname);
    return hosts;
  }

  /**
   * Create (or reuse) a single-use UPI QR for a PENDING_PAYMENT order. The amount always comes from the order.
   * Paid only when the signed webhook (qr_code.credited) arrives: showing the QR proves nothing.
   */
  async ensureQr(orderId: string): Promise<{ qrId: string; qrImageUrl: string; expiresAt: Date }> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== 'PENDING_PAYMENT') throw new ForbiddenException('Order is not awaiting payment');

    const existing = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PENDING', method: 'UPI_QR', qrImageUrl: { not: null }, expiresAt: { gt: new Date(Date.now() + 60_000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.qrImageUrl && existing.expiresAt) return { qrId: existing.reference, qrImageUrl: existing.qrImageUrl, expiresAt: existing.expiresAt };

    const activeCard = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PENDING', method: { not: 'UPI_QR' }, checkoutUrl: { not: null }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
    });
    if (activeCard) throw new ConflictException('A card payment is already in progress. Complete it or cancel the order first.');

    const expiryMin = Number(this.config.get('PAYMENT_PENDING_EXPIRY_MINUTES') ?? 30);
    const orderExpiry = new Date(order.createdAt.getTime() + expiryMin * 60_000);
    if (orderExpiry.getTime() - Date.now() < 130_000) {
      throw new ConflictException('The order payment window is almost over. Cancel this order and place a new one.');
    }

    const gw = this.gateways[this.activeProvider];
    if (!gw?.createQr) throw new BadGatewayException('UPI QR is not available with the current payment provider');
    const expiresAt = new Date(Math.min(Date.now() + 15 * 60_000, orderExpiry.getTime()));
    let result;
    try {
      result = await gw.createQr({ orderNumber: order.orderNumber, amountPaise: order.totalPaise, expiresAt });
    } catch (e) {
      this.log.error(`QR creation failed for ${order.orderNumber}: ${(e as Error).message}`);
      throw new BadGatewayException('Could not create the UPI QR. Please try again.');
    }
    if (!isTrustedCheckoutUrl(result.qrImageUrl, this.trustedHosts(gw.name), !this.isProd)) {
      this.log.error(`Rejected untrusted QR image URL for ${order.orderNumber}`);
      throw new BadGatewayException('Payment provider returned an untrusted QR image URL');
    }
    await this.prisma.payment.create({
      data: { orderId: order.id, provider: gw.name, reference: result.reference, amountPaise: order.totalPaise, method: 'UPI_QR', qrImageUrl: result.qrImageUrl, expiresAt },
    });
    return { qrId: result.reference, qrImageUrl: result.qrImageUrl, expiresAt };
  }

  /**
   * Payment state for the card to poll. PAID only reflects what the signed webhook recorded.
   * A QR/link whose deadline passed without payment is reported EXPIRED so the guest can retry.
   */
  async paymentStatus(orderId: string): Promise<{ status: 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED'; amountPaise: number; paidAt: Date | null; expiresAt: Date | null }> {
    await this.reconcileRazorpayLink(orderId);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { orderBy: { createdAt: 'desc' } } } });
    return PaymentsService.derivePaymentStatus(order);
  }

  /**
   * Reconcile a pending hosted checkout directly with Razorpay. This covers delayed/missing webhooks
   * and the browser callback, which must never be trusted as payment proof on its own.
   */
  private async reconcileRazorpayLink(orderId: string) {
    if (this.activeProvider !== 'razorpay') return;
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, provider: 'razorpay', method: 'CARD', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) return;
    try {
      const result = await this.gateways.razorpay.fetchPaymentLink(payment.reference);
      if (result.status !== 'paid' || result.amountPaid !== payment.amountPaise || !result.paymentId) return;
      const changed = await this.prisma.$transaction((tx) => this.applyEvent(tx, 'razorpay', {
        eventId: `reconcile:${payment.reference}:${result.paymentId}`,
        reference: payment.reference,
        amountPaise: result.amountPaid,
        gatewayPaymentId: result.paymentId,
        type: 'PAID',
      }));
      if (changed) {
        this.realtime.emitOrderUpdated(changed);
        if (changed.status === 'CONFIRMED') this.realtime.emitKitchenNewOrder(changed);
      }
    } catch (error) {
      // Status reads should remain available during a transient Razorpay API outage.
      this.log.warn(`Razorpay reconciliation deferred for order ${orderId}: ${(error as Error).message}`);
    }
  }

  static derivePaymentStatus(order: {
    status: string; paymentStatus: string; paymentMethod: string; totalPaise: number; confirmedAt: Date | null;
    payments: { status: string; expiresAt: Date | null }[];
  }, now = Date.now()) {
    const latest = order.payments[0];
    const expiresAt = latest?.expiresAt ?? null;
    const unpaid = { amountPaise: order.totalPaise, paidAt: null as Date | null, expiresAt };
    if (['PAID', 'REFUND_REQUIRED', 'REFUNDED'].includes(order.paymentStatus)) {
      return { ...unpaid, paidAt: order.confirmedAt, status: 'PAID' as const };
    }
    if (order.paymentMethod === 'COD') return { ...unpaid, status: 'PENDING_PAYMENT' as const };
    if (order.status === 'PAYMENT_FAILED' || order.paymentStatus === 'FAILED') return { ...unpaid, status: 'FAILED' as const };
    if (order.status === 'EXPIRED' || order.status === 'CANCELLED' || order.paymentStatus === 'EXPIRED') return { ...unpaid, status: 'EXPIRED' as const };
    if (latest && latest.status === 'PENDING' && latest.expiresAt && latest.expiresAt.getTime() < now) return { ...unpaid, status: 'EXPIRED' as const };
    return { ...unpaid, status: 'PENDING_PAYMENT' as const };
  }

  // ---------------------------------------------------------------- webhook handling

  /**
   * The signed webhook is the ONLY proof of payment. The return URL never confirms anything.
   * Everything (event dedupe row + state change + outbox) happens in ONE transaction, so a processing
   * failure rolls the dedupe row back and the gateway's retry is processed again.
   */
  async handleWebhook(provider: string, rawBody: Buffer | undefined, headers: Headers) {
    const gw = this.gateways[provider];
    if (!gw || (provider === 'mock' && this.isProd)) throw new NotFoundException();
    if (!rawBody || !gw.verifySignature(rawBody, headers)) {
      this.log.warn(`Invalid webhook signature from ${provider}`);
      throw new UnauthorizedException('Invalid signature');
    }
    const event = gw.parseEvent(rawBody, headers);
    if (event.type === 'IGNORED' || !event.eventId || !event.reference) return { received: true, ignored: true };

    try {
      const changed = await this.prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({
          data: { provider, eventId: event.eventId, type: event.type, payload: JSON.parse(rawBody.toString('utf8')), processedAt: new Date() },
        });
        return this.applyEvent(tx, provider, event);
      });
      if (changed) {
        this.realtime.emitOrderUpdated(changed);
        if (changed.status === 'CONFIRMED') this.realtime.emitKitchenNewOrder(changed);
      }
      return { received: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { received: true, duplicate: true }; // duplicate delivery: already processed
      }
      throw e;
    }
  }

  private async applyEvent(tx: Prisma.TransactionClient, provider: string, ev: ReturnType<PaymentGateway['parseEvent']>) {
    const payment = await tx.payment.findUnique({ where: { provider_reference: { provider, reference: ev.reference } } });
    if (!payment) {
      this.log.warn(`Webhook for unknown payment reference ${ev.reference}`);
      return null;
    }
    // Serialise concurrent events for the same order.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${payment.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { customer: true } });

    if (ev.type === 'PAID') {
      if (payment.status === 'PAID') return null; // already applied
      if (ev.amountPaise !== payment.amountPaise) {
        // Amount verification: never confirm an order if the paid amount differs from what we expect.
        this.log.error(`Amount mismatch on ${order.orderNumber}: expected ${payment.amountPaise}, got ${ev.amountPaise}`);
        await this.outbox.enqueue(tx, 'ORDER', order.id, 'PAYMENT_AMOUNT_MISMATCH', this.snapshot(order));
        return null;
      }
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', gatewayPaymentId: ev.gatewayPaymentId } });
      if (order.status === 'PENDING_PAYMENT') {
        const updated = await tx.order.update({
          where: { id: order.id },
          data: { status: 'CONFIRMED', paymentStatus: 'PAID', confirmedAt: new Date() },
          include: { customer: true },
        });
        await this.outbox.enqueue(tx, 'ORDER', order.id, 'ORDER_CONFIRMED', this.snapshot(updated));
        return updated;
      }
      // Paid after the order expired/was cancelled: money received but no order -> flag for refund.
      const flagged = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUND_REQUIRED' }, include: { customer: true } });
      await this.outbox.enqueue(tx, 'ORDER', order.id, 'PAYMENT_REFUND_REQUIRED', this.snapshot(flagged));
      return flagged;
    }

    // FAILED / EXPIRED only affect orders that are still unpaid.
    if (payment.status === 'PAID') return null;
    const to = ev.type === 'EXPIRED' ? 'EXPIRED' : 'FAILED';
    await tx.payment.update({ where: { id: payment.id }, data: { status: to } });
    if (order.status !== 'PENDING_PAYMENT') return null;
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: to === 'EXPIRED' ? 'EXPIRED' : 'PAYMENT_FAILED', paymentStatus: to },
      include: { customer: true },
    });
    await this.outbox.enqueue(tx, 'ORDER', order.id, `ORDER_${updated.status}`, this.snapshot(updated));
    return updated;
  }

  private snapshot(o: {
    id: string; orderNumber: string; status: string; paymentStatus: string; fulfilment: string; totalPaise: number;
    customer: { name: string; phone: string };
  }) {
    return {
      orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, fulfilment: o.fulfilment,
      totalPaise: o.totalPaise, customerName: o.customer.name, customerPhone: o.customer.phone,
    };
  }

  // ---------------------------------------------------------------- abandoned checkout

  /** Expire unpaid orders. A late webhook after this is handled by the REFUND_REQUIRED branch. */
  async expireStale() {
    const expiryMin = Number(this.config.get('PAYMENT_PENDING_EXPIRY_MINUTES') ?? 30);
    const cutoff = new Date(Date.now() - expiryMin * 60_000);
    const stale = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
      include: { customer: true },
      take: 100,
    });
    for (const o of stale) {
      await this.prisma.$transaction(async (tx) => {
        const res = await tx.order.updateMany({ where: { id: o.id, status: 'PENDING_PAYMENT' }, data: { status: 'EXPIRED', paymentStatus: 'EXPIRED' } });
        if (res.count === 0) return;
        await tx.payment.updateMany({ where: { orderId: o.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
        await this.outbox.enqueue(tx, 'ORDER', o.id, 'ORDER_EXPIRED', this.snapshot({ ...o, status: 'EXPIRED', paymentStatus: 'EXPIRED' }));
      });
      this.realtime.emitOrderUpdated({ id: o.id, orderNumber: o.orderNumber, status: 'EXPIRED', paymentStatus: 'EXPIRED' });
    }
  }

  // ---------------------------------------------------------------- dev-only mock completion

  /** Simulates the gateway: builds a SIGNED webhook and sends it through the real handler. */
  async completeMock(reference: string, outcome: 'paid' | 'failed') {
    if (this.isProd || this.activeProvider !== 'mock') throw new NotFoundException();
    const payment = await this.prisma.payment.findUnique({ where: { provider_reference: { provider: 'mock', reference } } });
    if (!payment) throw new NotFoundException('Unknown payment');
    const raw = Buffer.from(
      JSON.stringify({
        id: `evt_${randomUUID()}`,
        event: outcome === 'paid' ? 'payment.paid' : 'payment.failed',
        reference,
        amount: payment.amountPaise,
        paymentId: `pay_${randomUUID()}`,
      }),
    );
    const sig = hmacHex(this.config.get<string>('MOCK_WEBHOOK_SECRET') ?? '', raw);
    return this.handleWebhook('mock', raw, { 'x-mock-signature': sig });
  }
}
