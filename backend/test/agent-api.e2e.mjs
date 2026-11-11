// End-to-end checks for the Salesforce/Agentforce API (/api/v1/agent/*). Needs the API running.
// Usage: node test/agent-api.e2e.mjs      (reads AGENT_API_KEY from env or backend/.env)
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const envFile = (() => { try { return readFileSync(new URL('../.env', import.meta.url), 'utf8'); } catch { return ''; } })();
const fromEnv = (k) => process.env[k] ?? envFile.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
const KEY = fromEnv('AGENT_API_KEY');
const STAFF = fromEnv('STAFF_API_KEY') ?? 'change-me-staff-key';
if (!KEY) { console.error('AGENT_API_KEY not found'); process.exit(2); }

let fails = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : x}`); if (!c) fails++; };
const call = async (path, { method = 'GET', body, headers = {}, key = KEY } = {}) => {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(key ? { 'x-api-key': key } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const staff = (path, method, body) => call(path, { method, body, key: null, headers: { 'x-staff-key': STAFF } });

const PHONE = '9000000001', OTHER = '9000000002';
const customer = { name: 'Agent Test', phone: '+91 90000 00001' };

// ---------------- auth
ok('no key -> 401', (await call('/agent/menu', { key: null })).status === 401);
ok('wrong key -> 401', (await call('/agent/menu', { key: 'nope' })).status === 401);

// ---------------- config
let r0 = await call('/agent/config');
ok('config: tax/fee/options come from the backend', r0.status === 200 && typeof r0.body.taxPercent === 'number' && typeof r0.body.deliveryFee === 'number' && r0.body.paymentMethods.includes('ONLINE') && r0.body.fulfilmentOptions.includes('TAKEAWAY') && Array.isArray(r0.body.servicePincodes), JSON.stringify(r0.body));

// ---------------- menu
let r = await call('/agent/categories');
ok('categories: 8 with ids, names and counts', r.status === 200 && r.body.categories.length === 8 && r.body.categories.every((c) => c.id && c.name && c.itemCount >= 1 && Array.isArray(c.subcategories)), JSON.stringify(r.body).slice(0, 200));
r = await call('/agent/menu');
const allItems = r.body.categories.flatMap((c) => c.items);
ok('menu: all dishes with real prices, rupees + paise', r.status === 200 && r.body.totalItems >= 22 && allItems.every((i) => i.pricePaise > 0 && i.price === i.pricePaise / 100 && i.currency === 'INR'));
ok('menu: absolute image URLs', allItems.every((i) => /^https?:\/\//.test(i.imageUrl)));
ok('menu: dietary + draft allergen/ingredient fields present', allItems.every((i) => i.dietary.vegetarian === true && Array.isArray(i.allergens)));
r = await call('/agent/menu?category=idli-dosa');
ok('menu filter by category slug', r.body.categories.length === 1 && r.body.categories[0].slug === 'idli-dosa' && r.body.categories[0].items.length === 3, JSON.stringify(r.body.categories.map((c) => c.slug)));
r = await call('/agent/menu?category=Idli');
ok('menu filter by category name fragment', r.body.categories.some((c) => c.slug === 'idli-dosa'));
r = await call('/agent/items?q=dosa');
ok('search "dosa" finds dosa dishes only', r.body.count >= 2 && r.body.items.every((i) => /dosa/i.test(JSON.stringify([i.name, i.description, i.tags]))), r.body.items?.map((i) => i.name).join(','));
r = await call('/agent/items?q=zzzznotadish');
ok('search with no match -> empty, 200', r.status === 200 && r.body.count === 0);
r = await call('/agent/items?category=idli-dosa&subcategory=dosa-varieties');
ok('subcategory filter returns an honest warning (menu has none)', r.status === 200 && r.body.warnings.some((w) => /no subcategories/i.test(w)) && r.body.count === 3);
r = await call('/agent/items?foo=bar');
ok('unknown query param rejected (validation)', r.status === 400);

const dosa = allItems.find((i) => i.slug === 'masala-dosa');
const pongal = allItems.find((i) => i.slug === 'pongal');
r = await call(`/agent/items/${dosa.slug}`);
ok('item by slug', r.status === 200 && r.body.id === dosa.id && r.body.category.slug === 'idli-dosa');
r = await call(`/agent/items/${dosa.id}`);
ok('item by id', r.status === 200 && r.body.slug === 'masala-dosa');
ok('unknown item -> 404', (await call('/agent/items/does-not-exist')).status === 404);

// ---------------- orders
const base = { items: [{ menuItemId: dosa.id, quantity: 2, notes: 'less spicy' }], customer, fulfilment: 'TAKEAWAY', paymentMethod: 'COD' };
const k1 = randomUUID();
r = await call('/agent/orders', { method: 'POST', body: base, headers: { 'Idempotency-Key': k1 } });
const cod = r.body;
ok('COD order created + confirmed, backend total', r.status === 201 && cod.status === 'CONFIRMED' && cod.total === dosa.price * 2 && cod.totalPaise === dosa.pricePaise * 2 && cod.nextAction === 'NONE', JSON.stringify(r.body).slice(0, 300));
ok('order keeps item notes (customisation)', cod.items[0].notes === 'less spicy' && cod.items[0].quantity === 2);
ok('order returns tracking URL + confirmation text', /\/order\/VR/.test(cod.trackingUrl) && /confirmed/i.test(cod.confirmation));
r = await call('/agent/orders', { method: 'POST', body: base, headers: { 'Idempotency-Key': k1 } });
ok('same Idempotency-Key replays the same order', r.body.orderNumber === cod.orderNumber && r.body.replay === true);
r = await call('/agent/orders', { method: 'POST', body: { ...base, idempotencyKey: randomUUID(), items: [{ menuItemId: pongal.id, quantity: 1 }] } });
ok('idempotencyKey in body accepted', r.status === 201 && r.body.items[0].name === 'Pongal');
r = await call('/agent/orders', { method: 'POST', body: base });
ok('missing idempotency key -> 400', r.status === 400);
r = await call('/agent/orders', { method: 'POST', body: { ...base, items: [{ menuItemId: dosa.id, quantity: 1, price: 1 }] }, headers: { 'Idempotency-Key': randomUUID() } });
ok('client-supplied price is rejected (never trusted)', r.status === 400);
r = await call('/agent/orders', { method: 'POST', body: { ...base, fulfilment: 'DELIVERY', address: { line1: 'Somewhere 12', pincode: '560001' } }, headers: { 'Idempotency-Key': randomUUID() } });
ok('delivery outside service area -> 422', r.status === 422 && r.body.code === 'DELIVERY_OUT_OF_AREA');
r = await call('/agent/orders', { method: 'POST', body: { ...base, fulfilment: 'DELIVERY' }, headers: { 'Idempotency-Key': randomUUID() } });
ok('delivery without address -> 422', r.status === 422 && r.body.code === 'ADDRESS_REQUIRED');
await staff(`/menu/items/${pongal.id}`, 'PATCH', { isAvailable: false });
r = await call('/agent/orders', { method: 'POST', body: { ...base, items: [{ menuItemId: pongal.id, quantity: 1 }] }, headers: { 'Idempotency-Key': randomUUID() } });
ok('unavailable item -> 409 ITEM_UNAVAILABLE', r.status === 409 && r.body.code === 'ITEM_UNAVAILABLE' && r.body.itemIds.includes(pongal.id));
r = await call('/agent/items?q=pongal');
ok('unavailable dish hidden by default', r.body.count === 0);
r = await call('/agent/items?q=pongal&includeUnavailable=true');
ok('includeUnavailable=true shows it flagged unavailable', r.body.count === 1 && r.body.items[0].isAvailable === false);
await staff(`/menu/items/${pongal.id}`, 'PATCH', { isAvailable: true });

// ---------------- details / status / ownership
r = await call('/agent/orders/details', { method: 'POST', body: { orderNumber: cod.orderNumber, customerPhone: '9000000001' } });
ok('order details with owner phone', r.status === 200 && r.body.orderNumber === cod.orderNumber && r.body.items.length === 1 && r.body.cancellable === true);
r = await call('/agent/orders/details', { method: 'POST', body: { orderNumber: cod.orderNumber, customerPhone: OTHER } });
ok('order details with another phone -> 404 (ownership)', r.status === 404);
r = await call('/agent/orders/details', { method: 'POST', body: { orderNumber: 'VR000000-NOPE', customerPhone: PHONE } });
ok('unknown order -> same 404 (no enumeration)', r.status === 404);
r = await call('/agent/orders/status', { method: 'POST', body: { orderNumber: cod.orderNumber, customerPhone: PHONE } });
ok('order status', r.status === 200 && r.body.status === 'CONFIRMED' && /confirmed/i.test(r.body.statusMessage));
r = await call('/agent/orders/status', { method: 'POST', body: { orderNumber: cod.orderNumber, customerPhone: 'abc' } });
ok('bad phone format -> 400', r.status === 400);

// ---------------- online payment pending, cancel before paying
r = await call('/agent/orders', { method: 'POST', body: { ...base, paymentMethod: 'ONLINE' }, headers: { 'Idempotency-Key': randomUUID() } });
const online = r.body;
ok('online order -> PENDING_PAYMENT + checkoutUrl + OPEN_CHECKOUT', r.status === 201 && online.status === 'PENDING_PAYMENT' && /\/pay\/mock/.test(online.checkoutUrl) && online.nextAction === 'OPEN_CHECKOUT', JSON.stringify(r.body).slice(0, 200));
r = await call('/agent/orders/status', { method: 'POST', body: { orderNumber: online.orderNumber, customerPhone: PHONE } });
ok('status of unpaid order carries the checkout link', r.body.status === 'PENDING_PAYMENT' && !!r.body.checkoutUrl);
r = await call('/agent/orders/cancel', { method: 'POST', body: { orderNumber: online.orderNumber, customerPhone: PHONE } });
ok('cancel unpaid online order -> cancelled, payment expired', r.status === 200 && r.body.cancelled === true && r.body.status === 'CANCELLED' && r.body.paymentStatus === 'EXPIRED' && r.body.refundRequired === false, JSON.stringify(r.body));

// ---------------- paid online order, then cancel -> refund flagged
r = await call('/agent/orders', { method: 'POST', body: { ...base, paymentMethod: 'ONLINE' }, headers: { 'Idempotency-Key': randomUUID() } });
const paidOrder = r.body;
const ref = new URL(paidOrder.checkoutUrl).searchParams.get('ref');
await call(`/payments/mock/${ref}/complete`, { method: 'POST', body: { outcome: 'paid' }, key: null });
r = await call('/agent/orders/status', { method: 'POST', body: { orderNumber: paidOrder.orderNumber, customerPhone: PHONE } });
ok('paid via signed webhook -> CONFIRMED/PAID', r.body.status === 'CONFIRMED' && r.body.paymentStatus === 'PAID', JSON.stringify(r.body));
r = await call('/agent/orders/cancel', { method: 'POST', body: { orderNumber: paidOrder.orderNumber, customerPhone: PHONE } });
ok('cancel paid order -> cancelled + REFUND_REQUIRED', r.body.cancelled === true && r.body.paymentStatus === 'REFUND_REQUIRED' && r.body.refundRequired === true && /refund/i.test(r.body.message), JSON.stringify(r.body));

// ---------------- cancel rules
r = await call('/agent/orders/cancel', { method: 'POST', body: { orderNumber: cod.orderNumber, customerPhone: OTHER } });
ok('cancel with wrong phone -> 404, order untouched', r.status === 404);
r = await call('/agent/orders/cancel', { method: 'POST', body: { orderNumber: cod.orderNumber, customerPhone: PHONE, reason: 'changed my mind' } });
ok('cancel COD order before kitchen starts', r.status === 200 && r.body.cancelled === true && r.body.status === 'CANCELLED');
r = await call('/agent/orders/cancel', { method: 'POST', body: { orderNumber: cod.orderNumber, customerPhone: PHONE } });
ok('cancel again -> not cancelled, ALREADY_CANCELLED (never a false success)', r.status === 200 && r.body.cancelled === false && r.body.code === 'ALREADY_CANCELLED');
r = await call('/agent/orders', { method: 'POST', body: base, headers: { 'Idempotency-Key': randomUUID() } });
const started = r.body;
const kitchen = await staff('/kitchen/orders', 'GET');
const kid = kitchen.body.find((o) => o.orderNumber === started.orderNumber).id;
await staff(`/kitchen/orders/${kid}/status`, 'PATCH', { status: 'PREPARING' });
r = await call('/agent/orders/cancel', { method: 'POST', body: { orderNumber: started.orderNumber, customerPhone: PHONE } });
ok('cannot cancel once the kitchen is preparing', r.status === 200 && r.body.cancelled === false && r.body.code === 'KITCHEN_STARTED' && r.body.status === 'PREPARING', JSON.stringify(r.body));
r = await call('/agent/orders/status', { method: 'POST', body: { orderNumber: started.orderNumber, customerPhone: PHONE } });
ok('status now reports not cancellable', r.body.cancellable === false);
r = await staff('/kitchen/orders', 'GET');
ok('cancelled orders are gone from the kitchen board', !r.body.some((o) => [cod.orderNumber, online.orderNumber, paidOrder.orderNumber].includes(o.orderNumber)));

// ---------------- reservations
const when = new Date(Date.now() + 2 * 86400000).toISOString();
r = await call('/agent/reservations', { method: 'POST', body: { customer, partySize: 4, startsAt: when, notes: 'Window table' } });
const res = r.body;
ok('reservation created', r.status === 201 && res.status === 'REQUESTED' && res.partySize === 4 && !!res.reservationId, JSON.stringify(r.body));
r = await call('/agent/reservations', { method: 'POST', body: { customer, partySize: 4, startsAt: new Date(Date.now() - 3600000).toISOString() } });
ok('reservation in the past -> 422', r.status === 422);
r = await call('/agent/reservations/details', { method: 'POST', body: { reservationId: res.reservationId, customerPhone: PHONE } });
ok('reservation details (owner)', r.status === 200 && r.body.notes === 'Window table');
r = await call('/agent/reservations/details', { method: 'POST', body: { reservationId: res.reservationId, customerPhone: OTHER } });
ok('reservation details with another phone -> 404', r.status === 404);
r = await call('/agent/reservations/cancel', { method: 'POST', body: { reservationId: res.reservationId, customerPhone: OTHER } });
ok('reservation cancel with wrong phone -> 404', r.status === 404);
r = await call('/agent/reservations/cancel', { method: 'POST', body: { reservationId: res.reservationId, customerPhone: PHONE } });
ok('reservation cancelled', r.body.cancelled === true && r.body.status === 'CANCELLED');
r = await call('/agent/reservations/cancel', { method: 'POST', body: { reservationId: res.reservationId, customerPhone: PHONE } });
ok('reservation cancel again -> ALREADY_CANCELLED', r.body.cancelled === false && r.body.code === 'ALREADY_CANCELLED');

// ---------------- existing public API still works
r = await fetch(`${API}/menu`);
ok('public website menu API unchanged', r.status === 200 && (await r.json()).length === 8);

console.log(fails ? `\n${fails} FAILED` : '\nALL AGENT API CHECKS PASSED');
process.exit(fails ? 1 : 0);
