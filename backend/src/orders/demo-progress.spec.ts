import { ConfigService } from '@nestjs/config';
import { DEMO_NEXT, DemoProgressService, isDue } from './demo-progress.service';

const cfg = (o: Record<string, string>) => ({ get: (k: string) => o[k] }) as unknown as ConfigService;
const svc = (o: Record<string, string>, orders: unknown = {}, prisma: unknown = {}) =>
  new DemoProgressService(prisma as never, cfg(o), orders as never);

describe('demo order progress', () => {
  it('follows CONFIRMED -> PREPARING -> READY -> COMPLETED and stops at COMPLETED', () => {
    expect(DEMO_NEXT.CONFIRMED).toBe('PREPARING');
    expect(DEMO_NEXT.PREPARING).toBe('READY');
    expect(DEMO_NEXT.READY).toBe('COMPLETED');
    expect(DEMO_NEXT.COMPLETED).toBeUndefined();
    expect(DEMO_NEXT.PENDING_PAYMENT).toBeUndefined(); // an unpaid order is never advanced
    expect(DEMO_NEXT.CANCELLED).toBeUndefined();
  });

  it('is off by default and in production unless explicitly allowed', () => {
    expect(svc({}).enabled).toBe(false);
    expect(svc({ ORDER_DEMO_AUTOPROGRESS: 'true' }).enabled).toBe(true);
    expect(svc({ ORDER_DEMO_AUTOPROGRESS: 'true', NODE_ENV: 'production' }).enabled).toBe(false);
    expect(svc({ ORDER_DEMO_AUTOPROGRESS: 'true', NODE_ENV: 'production', ORDER_DEMO_ALLOW_PRODUCTION: 'true' }).enabled).toBe(true);
  });

  it('uses a 10 second step unless configured, ignoring junk', () => {
    expect(svc({}).stepSeconds).toBe(10);
    expect(svc({ ORDER_DEMO_STEP_SECONDS: '30' }).stepSeconds).toBe(30);
    expect(svc({ ORDER_DEMO_STEP_SECONDS: 'abc' }).stepSeconds).toBe(10);
    expect(svc({ ORDER_DEMO_STEP_SECONDS: '0' }).stepSeconds).toBe(10);
  });

  it('an order is due only after it has held its status for the full step', () => {
    const t0 = new Date('2026-11-25T09:00:00Z');
    expect(isDue(t0, 10, t0.getTime() + 9_999)).toBe(false);
    expect(isDue(t0, 10, t0.getTime() + 10_000)).toBe(true);
  });

  it('tick advances only due orders, through the normal status update, one step at a time', async () => {
    const now = new Date('2026-11-25T09:00:30Z').getTime();
    const orders = [
      { id: 'a', orderNumber: 'A', status: 'CONFIRMED', confirmedAt: null, updatedAt: new Date(now), statusEvents: [{ at: new Date(now - 11_000) }] },
      { id: 'b', orderNumber: 'B', status: 'PREPARING', confirmedAt: null, updatedAt: new Date(now), statusEvents: [{ at: new Date(now - 3_000) }] },
      { id: 'c', orderNumber: 'C', status: 'READY', confirmedAt: null, updatedAt: new Date(now), statusEvents: [{ at: new Date(now - 60_000) }] },
    ];
    const updateStatus = jest.fn().mockResolvedValue({});
    const s = svc({ ORDER_DEMO_AUTOPROGRESS: 'true' }, { updateStatus }, { order: { findMany: jest.fn().mockResolvedValue(orders) } });
    await s.tick(now);
    expect(updateStatus.mock.calls).toEqual([['a', 'PREPARING'], ['c', 'COMPLETED']]); // b is not due yet
  });

  it('a conflict (the kitchen moved it first) does not stop the others', async () => {
    const now = Date.now();
    const old = { at: new Date(now - 60_000) };
    const orders = [
      { id: 'a', orderNumber: 'A', status: 'CONFIRMED', confirmedAt: null, updatedAt: new Date(), statusEvents: [old] },
      { id: 'b', orderNumber: 'B', status: 'CONFIRMED', confirmedAt: null, updatedAt: new Date(), statusEvents: [old] },
    ];
    const updateStatus = jest.fn().mockRejectedValueOnce(new Error('STATUS_CHANGED')).mockResolvedValue({});
    const s = svc({ ORDER_DEMO_AUTOPROGRESS: 'true' }, { updateStatus }, { order: { findMany: jest.fn().mockResolvedValue(orders) } });
    await s.tick(now);
    expect(updateStatus).toHaveBeenCalledTimes(2);
  });
});
