import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { safeEqual } from '../common/staff.guard';
import { canTransition, KITCHEN_VISIBLE } from '../common/order-status';
import { RealtimeGateway } from '../kitchen/realtime.gateway';
import { OutboxService } from '../outbox/outbox.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './orders.dto';
import { computeTotals, normalisePhone } from './pricing';

const orderInclude = { items: true, customer: true } satisfies Prisma.OrderInclude;
type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly payments: PaymentsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ---------------------------------------------------------------- create

  async create(dto: CreateOrderDto, idempotencyKey: string, userId?: string) {
    // 1. Duplicate submit: same key returns the same order instead of creating another.
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
    if (existing) return this.respond(existing, true);

    // 2. Fulfilment / payment rules
    const pincodes = (this.config.get<string>('SERVICE_PINCODES') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (dto.fulfilment === 'DELIVERY') {
      if (!dto.address) throw new UnprocessableEntityException({ code: 'ADDRESS_REQUIRED', message: 'Delivery address is required' });
      if (!pincodes.includes(dto.address.pincode)) {
        throw new UnprocessableEntityException({ code: 'DELIVERY_OUT_OF_AREA', message: 'We do not deliver to this pincode yet' });
      }
    }
    if (dto.paymentMethod === 'COD' && this.config.get('COD_ENABLED') !== 'true') {
      throw new UnprocessableEntityException({ code: 'COD_DISABLED', message: 'Cash on delivery/pay-at-counter is not available' });
    }

    // 3. Availability validation against the DB (never trust the client)
    const ids = [...new Set(dto.items.map((i) => i.menuItemId))];
    const menu = await this.prisma.menuItem.findMany({ where: { id: { in: ids } } });
    const byId = new Map(menu.map((m) => [m.id, m]));
    const unavailable = ids.filter((id) => !byId.get(id)?.isAvailable);
    if (unavailable.length) {
      throw new ConflictException({ code: 'ITEM_UNAVAILABLE', message: 'Some items are no longer available', itemIds: unavailable });
    }

    // 4. Server-side pricing + price-change detection
    const lines = dto.items.map((i) => {
      const m = byId.get(i.menuItemId)!;
      return { menuItemId: m.id, nameSnapshot: (m.names as Record<string, string>).en, unitPricePaise: m.pricePaise, quantity: i.quantity, notes: i.notes };
    });
    const deliveryFee = dto.fulfilment === 'DELIVERY' ? Number(this.config.get('DELIVERY_FEE_PAISE') ?? 0) : 0;
    const totals = computeTotals(lines, Number(this.config.get('TAX_PERCENT') ?? 0), deliveryFee);
    if (dto.expectedTotalPaise !== undefined && dto.expectedTotalPaise !== totals.totalPaise) {
      throw new ConflictException({ code: 'PRICE_CHANGED', message: 'Prices changed. Please review your cart.', newTotalPaise: totals.totalPaise });
    }

    // 5. Transactional creation of customer + order + items (+ outbox for COD)
    const isCod = dto.paymentMethod === 'COD';
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const phone = normalisePhone(dto.customer.phone);
        const customer = await tx.customer.upsert({
          where: { phone },
          update: { name: dto.customer.name, email: dto.customer.email, language: dto.customer.language },
          create: { phone, name: dto.customer.name, email: dto.customer.email, language: dto.customer.language ?? 'EN' },
        });
        const created = await tx.order.create({
          data: {
            orderNumber: this.newOrderNumber(),
            idempotencyKey,
            lookupToken: randomBytes(18).toString('hex'),
            customerId: customer.id,
            userId: userId ?? null,
            fulfilment: dto.fulfilment,
            paymentMethod: dto.paymentMethod,
            // COD is a separate approved path: goes straight to the kitchen. Online waits for the webhook.
            status: isCod ? 'CONFIRMED' : 'PENDING_PAYMENT',
            paymentStatus: isCod ? 'COD_PENDING' : 'PENDING',
            confirmedAt: isCod ? new Date() : null,
            ...totals,
            notes: dto.notes,
            deliveryAddress: dto.address ? { ...dto.address } : undefined,
            deliveryPincode: dto.address?.pincode,
            items: { create: lines.map((l) => ({ ...l, lineTotalPaise: l.unitPricePaise * l.quantity })) },
          },
          include: orderInclude,
        });
        if (isCod) await this.outbox.enqueue(tx, 'ORDER', created.id, 'ORDER_CONFIRMED', this.snapshot(created));
        return created;
      });
      if (isCod) {
        this.realtime.emitKitchenNewOrder(order);
        this.realtime.emitOrderUpdated(order);
      }
      return this.respond(order, false);
    } catch (e) {
      // Race: two concurrent submits with the same key. The unique index makes one win.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
        if (again) return this.respond(again, true);
      }
      throw e;
    }
  }

  private async respond(order: FullOrder, replay: boolean) {
    let checkoutUrl: string | undefined;
    if (order.status === 'PENDING_PAYMENT' && order.paymentMethod === 'ONLINE') {
      checkoutUrl = (await this.payments.ensureCheckout(order.id)).checkoutUrl;
    }
    return { ...this.view(order), lookupToken: order.lookupToken, checkoutUrl, replay };
  }

  private newOrderNumber() {
    const d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `VR${d}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  // ---------------------------------------------------------------- read

  view(o: FullOrder) {
    return {
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      fulfilment: o.fulfilment,
      subtotalPaise: o.subtotalPaise,
      taxPaise: o.taxPaise,
      deliveryFeePaise: o.deliveryFeePaise,
      totalPaise: o.totalPaise,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity, unitPricePaise: i.unitPricePaise, lineTotalPaise: i.lineTotalPaise })),
    };
  }

  /** Guest ownership check: order number + secret lookup token. Unknown or wrong token both give 404 (no enumeration). */
  async getForCustomer(orderNumber: string, token: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: orderInclude });
    if (!order || !safeEqual(order.lookupToken, token ?? '')) throw new NotFoundException('Order not found');
    let checkoutUrl: string | undefined;
    if (order.status === 'PENDING_PAYMENT' && order.paymentMethod === 'ONLINE') {
      checkoutUrl = (await this.payments.ensureCheckout(order.id).catch(() => undefined))?.checkoutUrl;
    }
    return { ...this.view(order), checkoutUrl };
  }

  async listForKitchen() {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: KITCHEN_VISIBLE } }, // PENDING_PAYMENT / FAILED / EXPIRED never appear here
      include: orderInclude,
      orderBy: { confirmedAt: 'asc' },
    });
    return orders.map((o) => ({ id: o.id, ...this.view(o), customerName: o.customer.name, notes: o.notes, confirmedAt: o.confirmedAt }));
  }

  async summary() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [byStatus, revenue] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: start } }, _count: true }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: start }, status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'] } },
        _sum: { totalPaise: true },
        _count: true,
      }),
    ]);
    return {
      since: start,
      ordersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      confirmedOrders: revenue._count,
      confirmedValuePaise: revenue._sum.totalPaise ?? 0,
    };
  }

  // ---------------------------------------------------------------- status updates (kitchen UI + Salesforce inbound)

  async updateStatus(id: string, to: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    if (!canTransition(order.status, to)) {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `Cannot move order from ${order.status} to ${to}` });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      // Compare-and-set on the previous status so concurrent updates cannot both win.
      const res = await tx.order.updateMany({ where: { id, status: order.status }, data: { status: to } });
      if (res.count === 0) throw new ConflictException({ code: 'STATUS_CHANGED', message: 'Order was updated by someone else' });
      const fresh = await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
      await this.outbox.enqueue(tx, 'ORDER', id, 'ORDER_STATUS_CHANGED', this.snapshot(fresh));
      return fresh;
    });
    this.realtime.emitOrderUpdated(updated);
    return this.view(updated);
  }

  async updateStatusByNumber(orderNumber: string, to: OrderStatus) {
    const o = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!o) throw new NotFoundException('Order not found');
    return this.updateStatus(o.id, to);
  }

  snapshot(o: FullOrder) {
    return {
      orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, fulfilment: o.fulfilment,
      totalPaise: o.totalPaise, customerName: o.customer.name, customerPhone: o.customer.phone,
    };
  }

  // ---------------------------------------------------------------- customer-owned access (used by the Salesforce/Agentforce API)

  /** Hosted-checkout URL for an unpaid online order (a fresh session is created if the old one expired). */
  async checkoutUrlFor(order: FullOrder): Promise<string | undefined> {
    if (order.status !== 'PENDING_PAYMENT' || order.paymentMethod !== 'ONLINE') return undefined;
    return (await this.payments.ensureCheckout(order.id).catch(() => undefined))?.checkoutUrl;
  }

  /** Ownership = the order's customer phone. Wrong phone and unknown order give the same 404 (no enumeration). */
  async findOwned(orderNumber: string, phone: string): Promise<FullOrder> {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: orderInclude });
    if (!order || order.customer.phone !== normalisePhone(phone)) throw new NotFoundException('Order not found');
    return order;
  }

  /** Customer cancellation rules: allowed until the kitchen starts preparing. */
  cancellability(o: { status: OrderStatus }): { cancellable: boolean; code: string; reason: string } {
    switch (o.status) {
      case 'PENDING_PAYMENT': return { cancellable: true, code: 'OK', reason: 'Payment has not been completed yet.' };
      case 'CONFIRMED': return { cancellable: true, code: 'OK', reason: 'The kitchen has not started preparing this order.' };
      case 'PREPARING': return { cancellable: false, code: 'KITCHEN_STARTED', reason: 'The kitchen has already started preparing this order.' };
      case 'READY':
      case 'OUT_FOR_DELIVERY': return { cancellable: false, code: 'READY_OR_DISPATCHED', reason: 'The order is ready or already on its way.' };
      case 'COMPLETED': return { cancellable: false, code: 'COMPLETED', reason: 'The order has already been completed.' };
      case 'CANCELLED': return { cancellable: false, code: 'ALREADY_CANCELLED', reason: 'The order is already cancelled.' };
      default: return { cancellable: false, code: 'CLOSED', reason: 'The order is closed (payment failed or expired).' };
    }
  }

  /**
   * Cancels an order on behalf of its customer. Only reports success after the database change committed.
   * A paid online order is flagged REFUND_REQUIRED (no refund API yet: staff refund it from the gateway).
   */
  async cancelByCustomer(orderNumber: string, phone: string) {
    const order = await this.findOwned(orderNumber, phone);
    const rule = this.cancellability(order);
    if (!rule.cancellable) return { cancelled: false, code: rule.code, message: rule.reason, order };

    const paidOnline = order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID';
    const paymentStatus = paidOnline ? 'REFUND_REQUIRED' : order.paymentStatus === 'PENDING' ? 'EXPIRED' : order.paymentStatus;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Compare-and-set so a kitchen status change racing with this cancel cannot both win.
      const res = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: 'CANCELLED', paymentStatus } });
      if (res.count === 0) throw new ConflictException({ code: 'STATUS_CHANGED', message: 'The order changed while cancelling. Please check its status and try again.' });
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
      await this.outbox.enqueue(tx, 'ORDER', order.id, 'ORDER_CANCELLED', this.snapshot(fresh));
      if (paidOnline) await this.outbox.enqueue(tx, 'ORDER', order.id, 'PAYMENT_REFUND_REQUIRED', this.snapshot(fresh));
      return fresh;
    });
    this.realtime.emitOrderUpdated(updated);
    return {
      cancelled: true,
      code: 'CANCELLED',
      message: paidOnline ? 'Order cancelled. Your online payment will be refunded by the restaurant team.' : 'Order cancelled.',
      refundRequired: paidOnline,
      order: updated,
    };
  }
}
