import { ConfigService } from '@nestjs/config';
import { computeTotals } from '../orders/pricing';
import { hmacHex } from './gateway/hmac';
import { RazorpayGateway } from './gateway/razorpay.gateway';
import { PaymentsService } from './payments.service';

const SECRET = 'whsec_test';
const cfg = { get: (k: string) => ({ RAZORPAY_WEBHOOK_SECRET: SECRET })[k] } as unknown as ConfigService;
const gw = new RazorpayGateway(cfg);
const body = (o: unknown) => Buffer.from(JSON.stringify(o));

describe('Razorpay webhook signature', () => {
  const raw = body({ event: 'qr_code.credited' });
  it('accepts a valid signature over the raw body', () => {
    expect(gw.verifySignature(raw, { 'x-razorpay-signature': hmacHex(SECRET, raw) })).toBe(true);
  });
  it('rejects an invalid, missing or tampered signature', () => {
    expect(gw.verifySignature(raw, { 'x-razorpay-signature': hmacHex('wrong', raw) })).toBe(false);
    expect(gw.verifySignature(raw, {})).toBe(false);
    expect(gw.verifySignature(body({ event: 'qr_code.credited', x: 1 }), { 'x-razorpay-signature': hmacHex(SECRET, raw) })).toBe(false);
  });
});

describe('Razorpay event parsing', () => {
  it('maps qr_code.credited to PAID using the credited payment amount', () => {
    const ev = gw.parseEvent(
      body({ event: 'qr_code.credited', payload: { qr_code: { entity: { id: 'qr_1', payment_amount: 5000 } }, payment: { entity: { id: 'pay_1', amount: 4900 } } } }),
      { 'x-razorpay-event-id': 'evt_1' },
    );
    expect(ev).toEqual({ eventId: 'evt_1', type: 'PAID', reference: 'qr_1', amountPaise: 4900, gatewayPaymentId: 'pay_1' });
  });
  it('maps payment_link.paid to PAID', () => {
    const ev = gw.parseEvent(
      body({ event: 'payment_link.paid', payload: { payment_link: { entity: { id: 'plink_1', amount: 7000 } }, payment: { entity: { id: 'pay_2' } } } }),
      { 'x-razorpay-event-id': 'evt_2' },
    );
    expect(ev).toMatchObject({ type: 'PAID', reference: 'plink_1', amountPaise: 7000, gatewayPaymentId: 'pay_2' });
  });
  it('ignores qr_code.closed and payment.failed (they can race a successful payment)', () => {
    expect(gw.parseEvent(body({ event: 'qr_code.closed', payload: { qr_code: { entity: { id: 'qr_1' } } } }), {}).type).toBe('IGNORED');
    expect(gw.parseEvent(body({ event: 'payment.failed' }), {}).type).toBe('IGNORED');
  });
});

describe('payment status derivation', () => {
  const base = { status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', paymentMethod: 'ONLINE', totalPaise: 26100, confirmedAt: null as Date | null };
  const future = new Date(Date.now() + 600_000);
  const past = new Date(Date.now() - 1000);

  it('is PENDING while the QR is live', () => {
    expect(PaymentsService.derivePaymentStatus({ ...base, payments: [{ status: 'PENDING', expiresAt: future }] }).status).toBe('PENDING_PAYMENT');
  });
  it('is EXPIRED once the QR deadline passes unpaid', () => {
    expect(PaymentsService.derivePaymentStatus({ ...base, payments: [{ status: 'PENDING', expiresAt: past }] }).status).toBe('EXPIRED');
  });
  it('is PAID only from the order state set by the webhook, never from the clock or a live QR', () => {
    const paid = PaymentsService.derivePaymentStatus({ ...base, status: 'CONFIRMED', paymentStatus: 'PAID', confirmedAt: new Date(), payments: [{ status: 'PAID', expiresAt: past }] });
    expect(paid.status).toBe('PAID');
    expect(paid.paidAt).not.toBeNull();
    expect(PaymentsService.derivePaymentStatus({ ...base, payments: [{ status: 'PENDING', expiresAt: future }] }).status).not.toBe('PAID');
  });
  it('reports FAILED and cancelled orders', () => {
    expect(PaymentsService.derivePaymentStatus({ ...base, status: 'PAYMENT_FAILED', paymentStatus: 'FAILED', payments: [] }).status).toBe('FAILED');
    expect(PaymentsService.derivePaymentStatus({ ...base, status: 'CANCELLED', paymentStatus: 'EXPIRED', payments: [] }).status).toBe('EXPIRED');
  });
});

describe('server-side totals', () => {
  it('adds tax and delivery fee in paise', () => {
    expect(computeTotals([{ unitPricePaise: 9000, quantity: 2 }, { unitPricePaise: 3000, quantity: 1 }], 5, 3000)).toEqual({
      subtotalPaise: 21000, taxPaise: 1050, deliveryFeePaise: 3000, totalPaise: 25050,
    });
  });
});

describe('online payment availability', () => {
  const mk = (o: Record<string, string>) => new RazorpayGateway({ get: (k: string) => o[k] } as unknown as ConfigService);
  it('is unavailable until the key id, key secret and webhook secret are all set', () => {
    expect(mk({}).configured).toBe(false);
    expect(mk({ RAZORPAY_KEY_ID: 'a', RAZORPAY_KEY_SECRET: 'b' }).configured).toBe(false);
    expect(mk({ RAZORPAY_KEY_ID: 'a', RAZORPAY_KEY_SECRET: 'b', RAZORPAY_WEBHOOK_SECRET: 'c' }).configured).toBe(true);
  });
  it('PaymentsService refuses an online order up front when the provider is not configured', () => {
    const svc = Object.create(PaymentsService.prototype) as unknown as { onlineAvailable: boolean; assertOnlineAvailable(): void } & Record<string, unknown>;
    const set = (k: string, v: unknown) => Object.defineProperty(svc, k, { value: v, configurable: true, writable: true });
    set('gateways', { razorpay: mk({}) });
    set('config', { get: (k: string) => ({ PAYMENT_PROVIDER: 'razorpay' })[k] });
    expect(svc.onlineAvailable).toBe(false);
    expect(() => svc.assertOnlineAvailable()).toThrow(/temporarily unavailable/);
    set('gateways', { razorpay: mk({ RAZORPAY_KEY_ID: 'a', RAZORPAY_KEY_SECRET: 'b', RAZORPAY_WEBHOOK_SECRET: 'c' }) });
    expect(svc.onlineAvailable).toBe(true);
    expect(() => svc.assertOnlineAvailable()).not.toThrow();
  });
});
