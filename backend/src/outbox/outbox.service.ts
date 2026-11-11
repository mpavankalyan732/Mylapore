import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesforceClient } from './salesforce.client';

type Tx = Prisma.TransactionClient | PrismaService;

/**
 * Transactional outbox: events are written in the SAME DB transaction as the business change,
 * then delivered to Salesforce by a retrying worker. Never call Salesforce in a request path.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OutboxService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sf: SalesforceClient,
    private readonly config: ConfigService,
  ) {}

  enqueue(tx: Tx, aggregateType: string, aggregateId: string, eventType: string, payload: Prisma.InputJsonValue) {
    return tx.outboxEvent.create({ data: { aggregateType, aggregateId, eventType, payload } });
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const every = Number(this.config.get('OUTBOX_POLL_MS') ?? 5000);
    this.timer = setInterval(() => void this.tick(), every);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Claim a batch with FOR UPDATE SKIP LOCKED so several workers can run safely. */
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
        UPDATE "OutboxEvent" SET status = 'PROCESSING'
        WHERE id IN (
          SELECT id FROM "OutboxEvent"
          WHERE status IN ('PENDING','FAILED') AND "nextAttemptAt" <= now()
          ORDER BY "createdAt" LIMIT 20 FOR UPDATE SKIP LOCKED)
        RETURNING id`;
      for (const { id } of claimed) await this.deliver(id);
    } catch (e) {
      this.log.error(`Outbox tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(id: string) {
    const ev = await this.prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    const max = Number(this.config.get('OUTBOX_MAX_ATTEMPTS') ?? 8);
    try {
      if (!this.sf.isConfigured()) {
        this.log.debug(`Salesforce not configured; ${ev.eventType} marked done (no-op)`);
      } else {
        await this.sf.sync(ev.aggregateType, ev.aggregateId, ev.eventType, ev.payload as Record<string, unknown>);
      }
      await this.prisma.outboxEvent.update({
        where: { id },
        data: { status: 'DONE', processedAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (e) {
      const attempts = ev.attempts + 1;
      const dead = attempts >= max;
      const backoffSec = Math.min(3600, 2 ** attempts * 5); // exponential backoff, capped at 1h
      await this.prisma.outboxEvent.update({
        where: { id },
        data: {
          status: dead ? 'DEAD' : 'FAILED',
          attempts,
          lastError: (e as Error).message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + backoffSec * 1000),
        },
      });
      if (dead) this.log.error(`Outbox event ${id} moved to dead-letter after ${attempts} attempts`);
    }
  }
}
