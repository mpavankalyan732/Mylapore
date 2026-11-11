import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto, ReservationsService } from '../reservations/reservations.module';
import { CreateAgentOrderDto, MenuQueryDto } from './agent.dto';
import { mapCategory, mapItem, RESERVATION_MESSAGE, STATUS_MESSAGE, toRupees } from './agent.mapper';

type FullOrder = Prisma.OrderGetPayload<{ include: { items: true; customer: true } }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Salesforce/Agentforce-facing API. It adds NO business rules of its own: menu data, pricing, availability,
 * order creation and cancellation all go through the same services the website uses.
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly reservations: ReservationsService,
  ) {}

  private get base() {
    return this.config.get<string>('PUBLIC_ASSET_URL') ?? this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  // ---------------------------------------------------------------- config

  /** Charges and options exactly as the backend applies them, so Salesforce never hard-codes tax rates or fees. */
  config_() {
    const pincodes = (this.config.get<string>('SERVICE_PINCODES') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const cod = this.config.get('COD_ENABLED') === 'true';
    return {
      currency: 'INR',
      taxPercent: Number(this.config.get('TAX_PERCENT') ?? 0),
      deliveryFee: toRupees(Number(this.config.get('DELIVERY_FEE_PAISE') ?? 0)),
      deliveryFeePaise: Number(this.config.get('DELIVERY_FEE_PAISE') ?? 0),
      servicePincodes: pincodes,
      fulfilmentOptions: ['DINE_IN', 'TAKEAWAY', ...(pincodes.length ? ['DELIVERY'] : [])],
      paymentMethods: ['ONLINE', ...(cod ? ['COD'] : [])],
      cancellationPolicy: 'An order can be cancelled until the kitchen starts preparing it.',
    };
  }

  // ---------------------------------------------------------------- menu

  private async loadMenu(q: MenuQueryDto) {
    const warnings: string[] = [];
    if (q.subcategory) warnings.push('The restaurant menu has no subcategories, so the subcategory filter was ignored. Use search (q) instead.');
    const showAll = q.includeUnavailable === 'true';
    const cats = await this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' } } } });

    const wanted = q.category?.trim().toLowerCase();
    const needle = q.q?.trim().toLowerCase();
    const matchCat = (c: (typeof cats)[number]) =>
      !wanted || c.id === q.category || c.slug === wanted || String((c.names as Record<string, string>).en).toLowerCase().includes(wanted);
    if (wanted && !cats.some(matchCat)) warnings.push(`No category matches "${q.category}".`);

    const out = cats.filter(matchCat).map((c) => ({
      ...c,
      items: c.items.filter((i) => {
        if (!showAll && !i.isAvailable) return false;
        if (!needle) return true;
        const hay = [...Object.values(i.names as object), ...Object.values(i.descriptions as object), ...i.tags, i.cuisine ?? '', String((c.names as Record<string, string>).en)];
        return hay.some((s) => String(s).toLowerCase().includes(needle));
      }),
    }));
    return { cats: out, warnings };
  }

  async menu(q: MenuQueryDto) {
    const { cats, warnings } = await this.loadMenu(q);
    const categories = cats.filter((c) => c.items.length > 0 || (!q.q && !q.category)).map((c) => ({
      ...mapCategory(c, this.base),
      items: c.items.map((i) => mapItem(i, c, this.base)),
    }));
    return { currency: 'INR', totalItems: categories.reduce((n, c) => n + c.items.length, 0), categories, warnings };
  }

  async categories() {
    const cats = await this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { items: true } });
    return { categories: cats.map((c) => mapCategory(c, this.base)), warnings: [] as string[] };
  }

  async items(q: MenuQueryDto) {
    const { cats, warnings } = await this.loadMenu(q);
    const items = cats.flatMap((c) => c.items.map((i) => mapItem(i, c, this.base)));
    return { currency: 'INR', count: items.length, items, warnings };
  }

  async item(ref: string) {
    const item = await this.prisma.menuItem.findFirst({ where: UUID.test(ref) ? { id: ref } : { slug: ref.toLowerCase() }, include: { category: true } });
    if (!item) throw new NotFoundException('Menu item not found');
    return mapItem(item, item.category, this.base);
  }

  // ---------------------------------------------------------------- orders

  private mapOrder(o: FullOrder) {
    const c = this.orders.cancellability(o);
    return {
      orderNumber: o.orderNumber,
      status: o.status,
      statusMessage: STATUS_MESSAGE[o.status] ?? o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      fulfilment: o.fulfilment,
      createdAt: o.createdAt.toISOString(),
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
      customerName: o.customer.name,
      deliveryPincode: o.deliveryPincode,
      deliveryAddress: (o.deliveryAddress as Record<string, string> | null) ?? null,
      notes: o.notes,
      currency: 'INR',
      items: o.items.map((i) => ({
        menuItemId: i.menuItemId, name: i.nameSnapshot, quantity: i.quantity, notes: i.notes,
        unitPrice: toRupees(i.unitPricePaise), unitPricePaise: i.unitPricePaise, lineTotal: toRupees(i.lineTotalPaise), lineTotalPaise: i.lineTotalPaise,
      })),
      subtotal: toRupees(o.subtotalPaise), subtotalPaise: o.subtotalPaise,
      tax: toRupees(o.taxPaise), taxPaise: o.taxPaise,
      deliveryFee: toRupees(o.deliveryFeePaise), deliveryFeePaise: o.deliveryFeePaise,
      total: toRupees(o.totalPaise), totalPaise: o.totalPaise,
      cancellable: c.cancellable,
      cancellableReason: c.reason,
    };
  }

  async createOrder(dto: CreateAgentOrderDto, headerKey?: string) {
    const key = headerKey ?? dto.idempotencyKey;
    if (!key || key.length < 8 || key.length > 100) throw new BadRequestException('Idempotency-Key header (or idempotencyKey, 8-100 chars) is required');
    const { idempotencyKey: _ignored, ...orderDto } = dto; // eslint-disable-line @typescript-eslint/no-unused-vars
    const res = await this.orders.create(orderDto, key); // same validation, pricing and availability rules as the website
    const full = await this.prisma.order.findUniqueOrThrow({ where: { orderNumber: res.orderNumber }, include: { items: true, customer: true } });
    const mapped = this.mapOrder(full);
    return {
      ...mapped,
      replay: res.replay,
      checkoutUrl: res.checkoutUrl ?? null,
      nextAction: res.checkoutUrl ? 'OPEN_CHECKOUT' : 'NONE',
      trackingUrl: `${this.base.replace(/\/$/, '')}/order/${res.orderNumber}?t=${res.lookupToken}`,
      confirmation: res.checkoutUrl
        ? `Order ${res.orderNumber} created. It will be sent to the kitchen once the online payment is completed.`
        : `Order ${res.orderNumber} is confirmed and sent to the kitchen.`,
    };
  }

  async orderDetails(orderNumber: string, phone: string) {
    const o = await this.orders.findOwned(orderNumber, phone);
    return { ...this.mapOrder(o), checkoutUrl: (await this.orders.checkoutUrlFor(o)) ?? null };
  }

  async orderStatus(orderNumber: string, phone: string) {
    const o = await this.orders.findOwned(orderNumber, phone);
    const m = this.mapOrder(o);
    return {
      orderNumber: m.orderNumber, status: m.status, statusMessage: m.statusMessage, paymentStatus: m.paymentStatus,
      fulfilment: m.fulfilment, total: m.total, totalPaise: m.totalPaise, currency: 'INR',
      cancellable: m.cancellable, cancellableReason: m.cancellableReason,
      checkoutUrl: (await this.orders.checkoutUrlFor(o)) ?? null,
    };
  }

  async cancelOrder(orderNumber: string, phone: string) {
    const r = await this.orders.cancelByCustomer(orderNumber, phone);
    const order = this.mapOrder(r.order as FullOrder);
    return {
      cancelled: r.cancelled,
      code: r.code,
      message: r.message,
      refundRequired: 'refundRequired' in r ? r.refundRequired : false,
      orderNumber: order.orderNumber,
      status: order.status,
      statusMessage: order.statusMessage,
      paymentStatus: order.paymentStatus,
      total: order.total,
      currency: 'INR',
    };
  }

  // ---------------------------------------------------------------- reservations

  private mapReservation(r: { id: string; status: string; partySize: number; startsAt: Date; notes: string | null; createdAt?: Date; customer?: { name: string } }) {
    return {
      reservationId: r.id, status: r.status, statusMessage: RESERVATION_MESSAGE[r.status] ?? r.status,
      partySize: r.partySize, startsAt: r.startsAt.toISOString(), notes: r.notes ?? null,
      customerName: r.customer?.name ?? null, createdAt: r.createdAt?.toISOString() ?? null,
    };
  }

  async createReservation(dto: CreateReservationDto) {
    const r = await this.reservations.create(dto);
    return this.mapReservation({ ...r, notes: dto.notes ?? null, customer: { name: dto.customer.name } });
  }

  async reservationDetails(id: string, phone: string) {
    return this.mapReservation(await this.reservations.findOwned(id, phone));
  }

  async cancelReservation(id: string, phone: string) {
    const r = await this.reservations.cancelByCustomer(id, phone);
    return { cancelled: r.cancelled, code: r.code, message: r.message, ...this.mapReservation(r.reservation) };
  }
}
