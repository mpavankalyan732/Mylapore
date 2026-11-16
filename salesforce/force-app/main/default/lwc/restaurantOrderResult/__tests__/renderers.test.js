import { createElement } from 'lwc';
import RestaurantOrderResult from 'c/restaurantOrderResult';
import RestaurantCancellationView from 'c/restaurantCancellationView';
import RestaurantMenuView from 'c/restaurantMenuView';
import RestaurantOrderStatusView from 'c/restaurantOrderStatusView';
import RestaurantReservationView from 'c/restaurantReservationView';
import RestaurantItemView from 'c/restaurantItemView';

function build(tag, Ctor, value) {
    const el = createElement(tag, { is: Ctor });
    el.value = value;
    document.body.appendChild(el);
    return el;
}
const text = (el) => el.shadowRoot.textContent.replace(/\s+/g, ' ');

describe('Agentforce renderers', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    describe('order result', () => {
        const ORDER = {
            success: true, orderNumber: 'VR1', status: 'PENDING_PAYMENT', currencyCode: 'INR', subtotal: 180, tax: 9, deliveryFee: 0, total: 189,
            items: [{ menuItemId: 'd', name: 'Masala Dosa', quantity: 2, lineTotal: 180, notes: 'less spicy' }], nextAction: 'OPEN_CHECKOUT',
            checkoutUrl: 'https://pay.example.com/x', trackingUrl: 'https://shop.example.com/order/VR1', confirmation: 'Order created.'
        };

        test('shows the order, the backend total and a Pay now link for online orders', () => {
            const el = build('c-restaurant-order-result', RestaurantOrderResult, ORDER);
            expect(text(el)).toContain('Order VR1');
            expect(text(el)).toContain('2 × Masala Dosa');
            expect(text(el)).toContain('less spicy');
            expect(text(el)).toMatch(/189/);
            const pay = el.shadowRoot.querySelector('a.btn');
            expect(pay.href).toBe('https://pay.example.com/x');
            expect(pay.rel).toContain('noopener');
        });

        test('never links to an unsafe payment URL', () => {
            const el = build('c-restaurant-order-result', RestaurantOrderResult, { ...ORDER, checkoutUrl: 'javascript:alert(1)', trackingUrl: 'http://insecure.example.com' });
            expect(el.shadowRoot.querySelector('a')).toBeNull();
        });

        test('failure is shown as "not placed" with no order number', () => {
            const el = build('c-restaurant-order-result', RestaurantOrderResult, { success: false, errorCode: 'ITEM_UNAVAILABLE', message: 'Some items are no longer available' });
            expect(text(el)).toContain('The order was not placed');
            expect(text(el)).toContain('no longer available');
            expect(text(el)).not.toContain('Order VR');
        });
    });

    describe('cancellation', () => {
        test('success only when the backend confirmed cancellation', () => {
            const el = build('c-restaurant-cancellation-view', RestaurantCancellationView, { success: true, cancelled: true, orderNumber: 'VR1', message: 'Order cancelled.', refundRequired: true });
            expect(text(el)).toContain('Order VR1 is cancelled');
            expect(text(el)).toContain('refund');
        });

        test('a refusal is shown as NOT cancelled', () => {
            const el = build('c-restaurant-cancellation-view', RestaurantCancellationView, { success: true, cancelled: false, code: 'KITCHEN_STARTED', status: 'PREPARING', message: 'The kitchen has already started preparing this order.' });
            expect(text(el)).toContain('The order was not cancelled');
            expect(text(el)).not.toContain('is cancelled');
            expect(text(el)).toContain('Being prepared');
        });

        test('an API failure is never shown as a cancellation', () => {
            const el = build('c-restaurant-cancellation-view', RestaurantCancellationView, { success: false, cancelled: false, message: 'No order was found.' });
            expect(text(el)).toContain('The order was not cancelled');
        });
    });

    describe('menu view', () => {
        test('lists categories with dishes, prices and unavailable flags, and warnings', () => {
            const el = build('c-restaurant-menu-view', RestaurantMenuView, {
                success: true, currencyCode: 'INR', warnings: ['Subcategory filter ignored'],
                categories: [{ id: 'c1', name: 'Idli & Dosa', items: [{ id: 'd', name: 'Masala Dosa', description: 'Crisp', price: 90, imageUrl: 'https://x/y.jpg' }, { id: 'p', name: 'Pongal', description: 'Warm', price: 70, isAvailable: false }] }]
            });
            expect(text(el)).toContain('Idli & Dosa');
            expect(text(el)).toContain('2 dishes');
            expect(text(el)).toContain('Masala Dosa');
            expect(text(el)).toMatch(/90/);
            expect(text(el)).toContain('Currently unavailable');
            expect(text(el)).toContain('Subcategory filter ignored');
        });

        test('caps long lists to keep the chat compact', () => {
            const items = Array.from({ length: 20 }, (_, n) => ({ id: `i${n}`, name: `Dish ${n}`, price: 10 }));
            const el = build('c-restaurant-menu-view', RestaurantMenuView, { success: true, items });
            expect(el.shadowRoot.querySelectorAll('.dish')).toHaveLength(12);
            expect(text(el)).toContain('+ 8 more');
        });

        test('empty result and failures are explained', () => {
            expect(text(build('c-restaurant-menu-view', RestaurantMenuView, { success: true, categories: [], items: [] }))).toContain('No matching dishes');
            expect(text(build('c-restaurant-menu-view', RestaurantMenuView, { success: false, message: 'The restaurant system had a problem.' }))).toContain('had a problem');
        });
    });

    describe('status, reservation and item views', () => {
        test('status view shows a timeline for active orders and none for cancelled ones', () => {
            const active = build('c-restaurant-order-status-view', RestaurantOrderStatusView, { success: true, orderNumber: 'VR1', status: 'PREPARING', fulfilment: 'TAKEAWAY', total: 189, currencyCode: 'INR' });
            expect(active.shadowRoot.querySelectorAll('.timeline li')).toHaveLength(4);
            expect(active.shadowRoot.querySelectorAll('.step-done')).toHaveLength(2);
            const cancelled = build('c-restaurant-order-status-view', RestaurantOrderStatusView, { success: true, orderNumber: 'VR2', status: 'CANCELLED', total: 1 });
            expect(cancelled.shadowRoot.querySelector('.timeline')).toBeNull();
        });

        test('reservation view shows details; a refused cancellation is an error', () => {
            const ok = build('c-restaurant-reservation-view', RestaurantReservationView, { success: true, reservationId: 'r1', status: 'REQUESTED', statusMessage: 'Request received', partySize: 4, startsAt: '2026-12-01T14:00:00.000Z' });
            expect(text(ok)).toContain('Table reservation');
            expect(text(ok)).toContain('4');
            const refused = build('c-restaurant-reservation-view', RestaurantReservationView, { success: true, cancelled: false, message: 'The reservation is already cancelled.' });
            expect(text(refused)).toContain('already cancelled');
            expect(text(refused)).not.toContain('Table reservation');
        });

        test('item view shows dietary info, allergens and the safety notice', () => {
            const el = build('c-restaurant-item-view', RestaurantItemView, {
                success: true, notice: 'Always check allergies.',
                item: { name: 'Pongal', price: 70, currencyCode: 'INR', description: 'Warm', isVegan: false, allergens: ['Milk', 'Tree nuts'], ingredients: 'Rice, dal', isAvailable: false }
            });
            expect(text(el)).toContain('Pongal');
            expect(text(el)).toContain('Milk, Tree nuts');
            expect(text(el)).toContain('Rice, dal');
            expect(text(el)).toContain('Always check allergies.');
            expect(text(el)).toContain('Currently unavailable');
        });
    });
});
