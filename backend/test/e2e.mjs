import { createHmac, randomUUID } from 'crypto';
const API = 'http://localhost:4000/api/v1';
const STAFF = { 'x-staff-key': 'change-me-staff-key' };
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); if (!cond) fails++; };
const call = async (path, init = {}) => {
  const r = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const menu = (await call('/menu')).body;
const items = menu.flatMap((c) => c.items);
ok('menu has 22 items with images', items.length === 22 && items.every((i) => (i.imageUrl.startsWith('https://') || i.imageUrl.startsWith('/menu/'))));
const cfg = (await call('/menu/config')).body;
ok('public config', cfg.paymentProvider === 'mock' && cfg.codEnabled === true, JSON.stringify(cfg));

const dosa = items.find((i) => i.slug === 'masala-dosa');
const customer = { name: 'Test User', phone: '9876543210' };
const base = { items: [{ menuItemId: dosa.id, quantity: 2 }], customer, fulfilment: 'TAKEAWAY', paymentMethod: 'ONLINE' };

// price change before confirmation
let r = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ ...base, expectedTotalPaise: 1 }) });
ok('price change -> 409 PRICE_CHANGED', r.status === 409 && r.body.code === 'PRICE_CHANGED' && r.body.newTotalPaise === 18000, JSON.stringify(r));

// missing idempotency key
r = await call('/orders', { method: 'POST', body: JSON.stringify(base) });
ok('missing Idempotency-Key -> 400', r.status === 400);

// delivery out of area
r = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ ...base, fulfilment: 'DELIVERY', address: { line1: 'x', pincode: '560001' } }) });
ok('delivery outside service area -> 422', r.status === 422 && r.body.code === 'DELIVERY_OUT_OF_AREA', JSON.stringify(r));

// unavailable item
await call(`/menu/items/${dosa.id}`, { method: 'PATCH', headers: STAFF, body: JSON.stringify({ isAvailable: false }) });
r = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify(base) });
ok('unavailable item -> 409', r.status === 409 && r.body.code === 'ITEM_UNAVAILABLE', JSON.stringify(r));
await call(`/menu/items/${dosa.id}`, { method: 'PATCH', headers: STAFF, body: JSON.stringify({ isAvailable: true }) });

// validation
r = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ ...base, customer: { name: 'A', phone: '123' } }) });
ok('bad phone -> 400', r.status === 400);

// online order + duplicate submit
const key = randomUUID();
const o1 = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ ...base, expectedTotalPaise: 18000 }) });
ok('online order PENDING_PAYMENT with checkoutUrl', o1.status === 201 && o1.body.status === 'PENDING_PAYMENT' && o1.body.checkoutUrl?.includes('/pay/mock'), JSON.stringify(o1));
const [d1, d2] = await Promise.all([1, 2].map(() => call('/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(base) })));
ok('duplicate submit returns same order (concurrent)', d1.body.orderNumber === o1.body.orderNumber && d2.body.orderNumber === o1.body.orderNumber, JSON.stringify([d1.body, d2.body]));

const num = o1.body.orderNumber, tok = o1.body.lookupToken;
const ref = new URL(o1.body.checkoutUrl).searchParams.get('ref');

// unpaid never reaches kitchen
r = await call('/kitchen/orders', { headers: STAFF });
ok('unpaid online order NOT on kitchen list', r.status === 200 && !r.body.some((o) => o.orderNumber === num));

// unauthorized lookup
ok('lookup without token -> 404', (await call(`/orders/${num}`)).status === 404);
ok('lookup wrong token -> 404', (await call(`/orders/${num}?token=wrong`)).status === 404);
ok('kitchen without staff key -> 401', (await call('/kitchen/orders')).status === 401);

// customer returns before webhook: still processing
r = await call(`/orders/${num}?token=${tok}`);
ok('return before webhook shows PENDING_PAYMENT only', r.body.status === 'PENDING_PAYMENT' && r.body.paymentStatus === 'PENDING', JSON.stringify(r.body));

// invalid webhook signature
const raw = JSON.stringify({ id: 'evt_forged', event: 'payment.paid', reference: ref, amount: 18000 });
let w = await fetch(`${API}/payments/webhook/mock`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-mock-signature': createHmac('sha256', 'wrong').update(raw).digest('hex') }, body: raw });
ok('invalid webhook signature -> 401', w.status === 401);
r = await call(`/orders/${num}?token=${tok}`);
ok('forged webhook did not confirm order', r.body.status === 'PENDING_PAYMENT');

// valid signed webhook (raw body verified)
const sign = (b) => createHmac('sha256', 'mock-secret').update(b).digest('hex');
const paid = JSON.stringify({ id: 'evt_paid_' + randomUUID(), event: 'payment.paid', reference: ref, amount: 18000, paymentId: 'pay_1' });
w = await fetch(`${API}/payments/webhook/mock`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-mock-signature': sign(paid) }, body: paid });
ok('valid webhook -> 200', w.status === 200, await w.text());
r = await call(`/orders/${num}?token=${tok}`);
ok('order CONFIRMED + PAID after webhook', r.body.status === 'CONFIRMED' && r.body.paymentStatus === 'PAID', JSON.stringify(r.body));

// duplicate webhook
w = await fetch(`${API}/payments/webhook/mock`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-mock-signature': sign(paid) }, body: paid });
const wb = await w.json();
ok('duplicate webhook acknowledged, not reprocessed', w.status === 200 && wb.duplicate === true, JSON.stringify(wb));

// kitchen sees it, status flow
r = await call('/kitchen/orders', { headers: STAFF });
const k = r.body.find((o) => o.orderNumber === num);
ok('paid order appears on kitchen list', !!k);
r = await call(`/kitchen/orders/${k.id}/status`, { method: 'PATCH', headers: STAFF, body: JSON.stringify({ status: 'COMPLETED' }) });
ok('invalid transition CONFIRMED->COMPLETED -> 409', r.status === 409 && r.body.code === 'INVALID_TRANSITION', JSON.stringify(r));
for (const s of ['PREPARING', 'READY', 'COMPLETED']) {
  r = await call(`/kitchen/orders/${k.id}/status`, { method: 'PATCH', headers: STAFF, body: JSON.stringify({ status: s }) });
  ok(`status -> ${s}`, r.status === 200 && r.body.status === s, JSON.stringify(r));
}

// COD path
r = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ ...base, paymentMethod: 'COD' }) });
ok('COD order CONFIRMED immediately, no checkoutUrl', r.body.status === 'CONFIRMED' && r.body.paymentStatus === 'COD_PENDING' && !r.body.checkoutUrl, JSON.stringify(r.body));

// mock gateway failure path + late payment after failure
const f = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify(base) });
const fref = new URL(f.body.checkoutUrl).searchParams.get('ref');
await call(`/payments/mock/${fref}/complete`, { method: 'POST', body: JSON.stringify({ outcome: 'failed' }) });
r = await call(`/orders/${f.body.orderNumber}?token=${f.body.lookupToken}`);
ok('failed payment -> PAYMENT_FAILED', r.body.status === 'PAYMENT_FAILED', JSON.stringify(r.body));
await call(`/payments/mock/${fref}/complete`, { method: 'POST', body: JSON.stringify({ outcome: 'paid' }) });
r = await call(`/orders/${f.body.orderNumber}?token=${f.body.lookupToken}`);
ok('paid-after-failure flagged REFUND_REQUIRED, order not confirmed', r.body.status === 'PAYMENT_FAILED' && r.body.paymentStatus === 'REFUND_REQUIRED', JSON.stringify(r.body));

// integrations
const IK = { 'x-integration-key': 'change-me-sf-inbound-key' };
r = await call('/integrations/agentforce/order-lookup', { method: 'POST', headers: IK, body: JSON.stringify({ orderNumber: num, customerPhone: '9000000000' }) });
ok('agent lookup with wrong phone (ownership) -> 404', r.status === 404);
r = await call('/integrations/agentforce/order-lookup', { method: 'POST', headers: IK, body: JSON.stringify({ orderNumber: num, customerPhone: '+91 98765 43210' }) });
ok('agent lookup with owner phone -> structured status', r.status === 201 && r.body.status === 'COMPLETED', JSON.stringify(r));
const lim = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify(base) });
ok('order rate limit (10/min) -> 429', lim.status === 429, JSON.stringify(lim));
await new Promise((r) => setTimeout(r, 62000));
const p = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify(base) });
r = await call('/integrations/agentforce/order-lookup', { method: 'POST', headers: IK, body: JSON.stringify({ orderNumber: p.body.orderNumber, customerPhone: '9876543210' }) });
ok('agent lookup for unpaid order returns action OPEN_CHECKOUT + checkoutUrl', r.body.action?.type === 'OPEN_CHECKOUT' && r.body.checkoutUrl === p.body.checkoutUrl, JSON.stringify(r.body));
r = await call('/integrations/salesforce/order-status', { method: 'POST', body: JSON.stringify({ orderNumber: num, status: 'READY' }) });
ok('SF inbound without key -> 401', r.status === 401);

// accounts
const email = `user${Date.now()}@example.com`;
r = await call('/auth/register', { method: 'POST', body: JSON.stringify({ firstName: 'John', lastName: 'Doe', identifier: email, password: 'short' }) });
ok('register with short password -> 400', r.status === 400);
r = await call('/auth/register', { method: 'POST', body: JSON.stringify({ firstName: 'John', lastName: 'Doe', identifier: email, password: 'longenough1' }) });
ok('register -> 201 + token', r.status === 201 && !!r.body.token && r.body.user.email === email, JSON.stringify(r));
const jwt = r.body.token;
r = await call('/auth/register', { method: 'POST', body: JSON.stringify({ firstName: 'J', lastName: 'D', identifier: email.toUpperCase(), password: 'longenough1' }) });
ok('duplicate register (case-insensitive) -> 409', r.status === 409);
r = await call('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: email, password: 'wrong-password' }) });
ok('wrong password -> 401', r.status === 401);
r = await call('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'nobody@example.com', password: 'whatever123' }) });
ok('unknown account -> same 401', r.status === 401 && r.body.message === 'Incorrect email/phone or password');
r = await call('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: email, password: 'longenough1' }) });
ok('login -> 200 + token', r.status === 200 && !!r.body.token);
ok('/auth/me without token -> 401', (await call('/auth/me')).status === 401);
r = await call('/auth/me', { headers: { Authorization: `Bearer ${jwt}` } });
ok('/auth/me with token', r.status === 200 && r.body.email === email);
ok('tampered token rejected', (await call('/auth/me', { headers: { Authorization: `Bearer ${jwt}x` } })).status === 401);
r = await call('/auth/code/request', { method: 'POST', body: JSON.stringify({ identifier: email }) });
ok('code request returns devCode (non-prod)', r.status === 200 && /^\d{6}$/.test(r.body.devCode ?? ''), JSON.stringify(r));
const devCode = r.body.devCode;
r = await call('/auth/code/verify', { method: 'POST', body: JSON.stringify({ identifier: email, code: devCode === '000000' ? '111111' : '000000' }) });
ok('wrong code -> 401', r.status === 401);
r = await call('/auth/code/verify', { method: 'POST', body: JSON.stringify({ identifier: email, code: devCode }) });
ok('correct code -> session', r.status === 200 && !!r.body.token, JSON.stringify(r));
r = await call('/auth/code/verify', { method: 'POST', body: JSON.stringify({ identifier: email, code: devCode }) });
ok('code cannot be reused', r.status === 401);
r = await call('/auth/code/request', { method: 'POST', body: JSON.stringify({ identifier: 'ghost@example.com' }) });
ok('code request for unknown account looks identical (no devCode, no leak)', r.status === 200 && r.body.sent === true && !r.body.devCode);
r = await call('/auth/google', { method: 'POST', body: JSON.stringify({ idToken: 'x' }) });
ok('google without client id -> 501 GOOGLE_NOT_CONFIGURED', r.status === 501 && r.body.code === 'GOOGLE_NOT_CONFIGURED', JSON.stringify(r));
const mine = await call('/orders', { method: 'POST', headers: { 'Idempotency-Key': randomUUID(), Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ ...base, paymentMethod: 'COD' }) });
r = await call('/me/orders', { headers: { Authorization: `Bearer ${jwt}` } });
ok('signed-in order appears in /me/orders', r.status === 200 && r.body.some((o) => o.orderNumber === mine.body.orderNumber), JSON.stringify(r.body));
ok('/me/orders without token -> 401', (await call('/me/orders')).status === 401);
r = await call('/menu/items/pongal');
ok('item detail has category, ingredients, allergens, tags', r.body.category?.slug === 'south-indian-breakfast' && !!r.body.ingredients && r.body.allergens.includes('Milk') && r.body.tags.includes('south-indian-rice'), JSON.stringify(r.body).slice(0, 200));

// reservation
r = await call('/reservations', { method: 'POST', body: JSON.stringify({ customer, partySize: 4, startsAt: new Date(Date.now() + 86400000).toISOString() }) });
ok('reservation created', r.status === 201 && r.body.status === 'REQUESTED', JSON.stringify(r));

r = await call('/kitchen/manager/summary', { headers: STAFF });
ok('manager summary', r.status === 200 && r.body.confirmedOrders >= 2, JSON.stringify(r.body));

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
