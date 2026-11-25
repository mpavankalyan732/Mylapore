import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

/** The step that follows each status in the demo flow. */
export const DEMO_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};

/** True when an order has held its current status for at least `stepSeconds`. */
export function isDue(since: Date, stepSeconds: number, now = Date.now()): boolean {
  return now - since.getTime() >= stepSeconds * 1000;
}

/**
 * DEMO MODE ONLY. Moves paid / confirmed orders along  CONFIRMED -> PREPARING -> READY -> COMPLETED  after a fixed delay
 * each, so the tracker can be shown without a kitchen. It uses the same updateStatus() as the kitchen screen, so every step
 * is saved with its real time, broadcast to the tracker and synced to Salesforce exactly like a genuine update.
 *
 * It is OFF unless ORDER_DEMO_AUTOPROGRESS=true. In production it also needs ORDER_DEMO_ALLOW_PRODUCTION=true, because a
 * real customer's order must never be marked Completed by a timer. PENDING_PAYMENT, cancelled, failed and expired
 * orders are never touched.
 */
@Injectable()
export class DemoProgressService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DemoProgressService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly orders: OrdersService) {}

  get enabled(): boolean {
    if (this.config.get('ORDER_DEMO_AUTOPROGRESS') !== 'true') return false;
    if (this.config.get('NODE_ENV') === 'production' && this.config.get('ORDER_DEMO_ALLOW_PRODUCTION') !== 'true') {
      this.log.warn('ORDER_DEMO_AUTOPROGRESS ignored in production (set ORDER_DEMO_ALLOW_PRODUCTION=true to allow it).');
      return false;
    }
    return true;
  }
  get stepSeconds(): number {
    const n = Number(this.config.get('ORDER_DEMO_STEP_SECONDS') ?? 10);
    return Number.isFinite(n) && n >= 1 ? n : 10;
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || !this.enabled) return;
    this.log.warn(`Demo order progress is ON: orders advance every ${this.stepSeconds}s. Not for real orders.`);
    this.timer = setInterval(() => void this.tick(), 2000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = Date.now()) {
    if (this.busy) return;
    this.busy = true;
    try {
      const orders = await this.prisma.order.findMany({
        where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } },
        include: { statusEvents: { orderBy: { at: 'desc' }, take: 1 } },
        take: 50,
      });
      for (const o of orders) {
        const next = DEMO_NEXT[o.status];
        const since = o.statusEvents[0]?.at ?? o.confirmedAt ?? o.updatedAt;
        if (!next || !isDue(since, this.stepSeconds, now)) continue;
        try {
          await this.orders.updateStatus(o.id, next);
        } catch (e) {
          this.log.debug(`Skipped ${o.orderNumber}: ${(e as Error).message}`); // e.g. the kitchen moved it first
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
