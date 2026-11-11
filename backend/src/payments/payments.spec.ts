import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { computeTotals, normalisePhone } from '../orders/pricing';
import { canTransition } from '../common/order-status';
import { hmacHex, verifyHmacHex } from './gateway/hmac';
import { MockGateway } from './gateway/mock.gateway';
import { PaymentsService } from './payments.service';
import { isTrustedCheckoutUrl } from './url-allowlist';

const cfg = (o: Record<string, string>) => ({ get: (k: string) => o[k] }) as unknown as ConfigService;

describe('pricing', () => {
  it('computes totals in paise on the server', () => {
    const t = computeTotals([{ unitPricePaise: 9000, quantity: 2 }, { unitPricePaise: 4000, quantity: 1 }], 5, 3000);
    expect(t).toEqual({ subtotalPaise: 22000, taxPaise: 1100, deliveryFeePaise: 3000, totalPaise: 26100 });
  });
  it('normalises Indian phone numbers', () => {
    expect(normalisePhone('+91 98765 43210')).toBe('9876543210');
  });
});

describe('order state machine', () => {
  it('never lets staff move PENDING_PAYMENT forward', () => {
    expect(canTransition('PENDING_PAYMENT', 'CONFIRMED')).toBe(false);
    expect(canTransition('PENDING_PAYMENT', 'PREPARING')).toBe(false);
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
  });
});

describe('checkout URL allow-list', () => {
  it('accepts trusted https hosts and subdomains only', () => {
    expect(isTrustedCheckoutUrl('https://rzp.io/i/abc', ['rzp.io'])).toBe(true);
    expect(isTrustedCheckoutUrl('https://pay.razorpay.com/x', ['razorpay.com'])).toBe(true);
    expect(isTrustedCheckoutUrl('https://evil.com/?rzp.io', ['rzp.io'])).toBe(false);
    expect(isTrustedCheckoutUrl('https://notrzp.io/x', ['rzp.io'])).toBe(false);
    expect(isTrustedCheckoutUrl('http://rzp.io/x', ['rzp.io'])).toBe(false);
    expect(isTrustedCheckoutUrl('https://user:pw@rzp.io/x', ['rzp.io'])).toBe(false);
    expect(isTrustedCheckoutUrl('javascript:alert(1)', ['rzp.io'])).toBe(false);
  });
});

describe('HMAC verification', () => {
  const body = Buffer.from('{"a":1}');
  it('accepts a correct signature and rejects tampering / missing / malformed', () => {
    const sig = hmacHex('s3cret', body);
    expect(verifyHmacHex('s3cret', body, sig)).toBe(true);
    expect(verifyHmacHex('s3cret', Buffer.from('{"a":2}'), sig)).toBe(false);
    expect(verifyHmacHex('wrong', body, sig)).toBe(false);
    expect(verifyHmacHex('s3cret', body, undefined)).toBe(false);
    expect(verifyHmacHex('s3cret', body, 'zz')).toBe(false);
  });
});

/** In-memory fake of the Prisma surface used by PaymentsService.handleWebhook. */
function fakeDb(order: { status: string }, payment: { status: string; amountPaise: number }) {
  const seen = new Set<string>();
  const state = { order: { id: 'o1', orderNumber: 'VR1', paymentStatus: 'PENDING', fulfilment: 'TAKEAWAY', totalPaise: payment.amountPaise, customer: { name: 'A', phone: '9876543210' }, ...order }, payment: { id: 'p1', orderId: 'o1', ...payment } };
  const outbox: string[] = [];
  const tx = {
    webhookEvent: {
      create: async ({ data }: any) => {
        if (seen.has(data.eventId)) throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
        seen.add(data.eventId);
      },
    },
    payment: {
      findUnique: async () => state.payment,
      update: async ({ data }: any) => Object.assign(state.payment, data),
    },
    order: {
      findUniqueOrThrow: async () => state.order,
      update: async ({ data }: any) => Object.assign(state.order, data),
    },
    $queryRaw: async () => [],
    outboxEvent: { create: async ({ data }: any) => outbox.push(data.eventType) },
  };
  const prisma = { $transaction: async (fn: any) => fn(tx), ...tx };
  return { prisma, state, outbox };
}

describe('PaymentsService.handleWebhook', () => {
  const secret = 'mock-secret';
  const events: any[] = [];
  const realtime = { emitOrderUpdated: (o: any) => events.push(o.status), emitKitchenNewOrder: () => events.push('kitchen') };
  const build = (db: ReturnType<typeof fakeDb>) => {
    const config = cfg({ MOCK_WEBHOOK_SECRET: secret, NODE_ENV: 'test' });
    const outbox = { enqueue: async (tx: any, _a: string, _id: string, type: string) => tx.outboxEvent.create({ data: { eventType: type } }) };
    return new PaymentsService(db.prisma as any, config, outbox as any, realtime as any, {} as any, new MockGateway(config));
  };
  const signed = (obj: object, key = secret) => {
    const raw = Buffer.from(JSON.stringify(obj));
    return { raw, headers: { 'x-mock-signature': hmacHex(key, raw) } };
  };
  const paid = (id = 'evt1', amount = 10000) => ({ id, event: 'payment.paid', reference: 'mock_1', amount });
  beforeEach(() => (events.length = 0));

  it('rejects an invalid signature (401) and changes nothing', async () => {
    const db = fakeDb({ status: 'PENDING_PAYMENT' }, { status: 'PENDING', amountPaise: 10000 });
    const { raw, headers } = signed(paid(), 'attacker-key');
    await expect(build(db).handleWebhook('mock', raw, headers)).rejects.toThrow('Invalid signature');
    expect(db.state.order.status).toBe('PENDING_PAYMENT');
  });

  it('confirms the order on a valid paid webhook and notifies the kitchen', async () => {
    const db = fakeDb({ status: 'PENDING_PAYMENT' }, { status: 'PENDING', amountPaise: 10000 });
    const { raw, headers } = signed(paid());
    await build(db).handleWebhook('mock', raw, headers);
    expect(db.state.order.status).toBe('CONFIRMED');
    expect(db.state.payment.status).toBe('PAID');
    expect(db.outbox).toEqual(['ORDER_CONFIRMED']);
    expect(events).toContain('kitchen');
  });

  it('is idempotent: a duplicate webhook is acknowledged but processed once', async () => {
    const db = fakeDb({ status: 'PENDING_PAYMENT' }, { status: 'PENDING', amountPaise: 10000 });
    const svc = build(db);
    const { raw, headers } = signed(paid());
    await svc.handleWebhook('mock', raw, headers);
    const second = await svc.handleWebhook('mock', raw, headers);
    expect(second).toMatchObject({ duplicate: true });
    expect(db.outbox).toEqual(['ORDER_CONFIRMED']);
  });

  it('does not confirm when the paid amount does not match the order', async () => {
    const db = fakeDb({ status: 'PENDING_PAYMENT' }, { status: 'PENDING', amountPaise: 10000 });
    const { raw, headers } = signed(paid('evt2', 9999));
    await build(db).handleWebhook('mock', raw, headers);
    expect(db.state.order.status).toBe('PENDING_PAYMENT');
    expect(db.outbox).toEqual(['PAYMENT_AMOUNT_MISMATCH']);
  });

  it('flags REFUND_REQUIRED when payment arrives after the order expired', async () => {
    const db = fakeDb({ status: 'EXPIRED' }, { status: 'EXPIRED', amountPaise: 10000 });
    const { raw, headers } = signed(paid('evt3'));
    await build(db).handleWebhook('mock', raw, headers);
    expect(db.state.order.status).toBe('EXPIRED');
    expect(db.state.order.paymentStatus).toBe('REFUND_REQUIRED');
    expect(db.outbox).toEqual(['PAYMENT_REFUND_REQUIRED']);
  });

  it('marks the order PAYMENT_FAILED on a failed webhook without reaching the kitchen', async () => {
    const db = fakeDb({ status: 'PENDING_PAYMENT' }, { status: 'PENDING', amountPaise: 10000 });
    const { raw, headers } = signed({ id: 'evt4', event: 'payment.failed', reference: 'mock_1', amount: 10000 });
    await build(db).handleWebhook('mock', raw, headers);
    expect(db.state.order.status).toBe('PAYMENT_FAILED');
    expect(events).not.toContain('kitchen');
  });
});
