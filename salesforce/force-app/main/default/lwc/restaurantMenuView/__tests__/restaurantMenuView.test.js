import { createElement } from 'lwc';
import RestaurantMenuView from 'c/restaurantMenuView';
import createOrder from '@salesforce/apex/RestaurantCartController.createOrder';
import startPayment from '@salesforce/apex/RestaurantCartController.startPayment';
import getPaymentStatus from '@salesforce/apex/RestaurantCartController.getPaymentStatus';
import cancelOrder from '@salesforce/apex/RestaurantOrderController.cancelOrder';
import getConfig from '@salesforce/apex/RestaurantMenuController.getConfig';

jest.mock('@salesforce/apex/RestaurantCartController.createOrder', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantCartController.startPayment', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantCartController.getPaymentStatus', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantOrderController.cancelOrder', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/resourceUrl/restaurantImages', () => ({ default: '/resource/restaurantImages' }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantMenuController.getConfig', () => ({ default: jest.fn() }), { virtual: true });

const MENU = {
    success: true,
    currencyCode: 'INR',
    categories: [
        {
            id: 'c1', name: 'Idli & Dosa',
            items: [
                { id: 'd', slug: 'masala-dosa', name: 'Masala Dosa', description: 'Crisp', price: 90, imageUrl: 'https://img.example.com/d.jpg', isAvailable: true, isVegetarian: true },
                { id: 'p', name: 'Pongal', description: 'Warm', price: 70, isAvailable: false }
            ]
        },
        { id: 'c2', name: 'Beverages', items: [{ id: 'f', name: 'Filter Coffee', description: 'Hot', price: 40, isAvailable: true }] }
    ],
    items: []
};
const CONFIG = { taxPercent: 5, deliveryFee: 30, servicePincodes: ['517501'], fulfilmentOptions: ['TAKEAWAY', 'DINE_IN', 'DELIVERY'], paymentMethods: ['ONLINE', 'COD'] };
const ORDER = {
    success: true, orderNumber: 'VR1', status: 'PENDING_PAYMENT', paymentMethod: 'ONLINE', currencyCode: 'INR',
    subtotal: 220, tax: 11, deliveryFee: 0, total: 231,
    items: [{ menuItemId: 'd', name: 'Masala Dosa', quantity: 2, lineTotal: 180 }, { menuItemId: 'f', name: 'Filter Coffee', quantity: 1, lineTotal: 40 }]
};
const IN_TEN_MIN = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();
let paymentWindow;

const tick = async (n = 6) => {
    for (let i = 0; i < n; i++) {
        await Promise.resolve();
    }
};
const q = (el, sel) => el.shadowRoot.querySelector(sel);
const qa = (el, sel) => Array.from(el.shadowRoot.querySelectorAll(sel));
const text = (el) => el.shadowRoot.textContent.replace(/\s+/g, ' ');
const buttonWith = (el, label) => qa(el, 'button, a').find((b) => b.textContent.includes(label));
async function click(el, node) {
    node.click();
    await tick();
}
async function type(el, name, value) {
    const input = q(el, `[name="${name}"]`);
    input.value = value;
    input.dispatchEvent(new CustomEvent('change'));
    await tick();
}

function build(value = MENU) {
    const el = createElement('c-restaurant-menu-view', { is: RestaurantMenuView });
    el.value = value;
    document.body.appendChild(el);
    return el;
}
const addDish = (el, name) => buttonWith(el, 'Add') && qa(el, `button[aria-label="Add ${name}"]`)[0];

/** Menu -> cart -> details with two dosas and a coffee in the cart. */
async function toDetails(el) {
    await click(el, addDish(el, 'Masala Dosa'));
    await click(el, q(el, 'button[aria-label="Add one more Masala Dosa"]'));
    await click(el, addDish(el, 'Filter Coffee'));
    await click(el, q(el, '.bar-btn'));
    await click(el, buttonWith(el, 'Continue'));
}
async function fillDetails(el, { name = 'Asha', phone = '9876543210' } = {}) {
    await type(el, 'customerName', name);
    await type(el, 'customerPhone', phone);
}
async function submit(el) {
    q(el, '[data-action="review"]').click();
    await tick();
}
/** Whole happy path up to the "choose how to pay" panel. */
async function toPaymentChoice(el) {
    await toDetails(el);
    await fillDetails(el);
    await submit(el);
}

describe('restaurantMenuView card', () => {
    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
        getConfig.mockResolvedValue(CONFIG);
        createOrder.mockResolvedValue(ORDER);
        paymentWindow = { closed: false, opener: {}, location: { replace: jest.fn() }, close: jest.fn() };
        window.open = jest.fn(() => paymentWindow);
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('menu', () => {
        test('shows dishes with image, price, veg mark and an unavailable dish with a disabled button', async () => {
            const el = build();
            await tick();
            expect(text(el)).toContain('Masala Dosa');
            expect(text(el)).toMatch(/90/);
            expect(q(el, 'img.photo-img').src).toContain('masala-dosa.jpg');
            expect(q(el, '.veg')).not.toBeNull();
            expect(text(el)).toContain('Currently unavailable');
            const pongalRow = qa(el, 'li.dish').find((li) => li.textContent.includes('Pongal'));
            expect(pongalRow.querySelector('button').disabled).toBe(true);
        });

        test('dish photos load from the bundled static resource first, then the menu link, then a plate icon', async () => {
            const el = build();
            await tick();
            const dish = () => el.shadowRoot.querySelector('li.dish img.photo-img');
            expect(dish().src).toContain('/resource/restaurantImages/masala-dosa.jpg');
            dish().dispatchEvent(new CustomEvent('error'));
            await tick();
            expect(dish().src).toBe('https://img.example.com/d.jpg');
            dish().dispatchEvent(new CustomEvent('error'));
            await tick();
            expect(el.shadowRoot.querySelector('li.dish img.photo-img')).toBeNull();
            expect(el.shadowRoot.querySelector('.photo-empty')).not.toBeNull();
        });

        test('never loads an insecure image link', async () => {
            const el = build({ ...MENU, categories: [{ id: 'c', name: 'X', items: [{ id: 'a', name: 'A', price: 1, imageUrl: 'http://insecure.example.com/a.jpg' }] }] });
            await tick();
            expect(q(el, 'img.photo-img')).toBeNull();
            expect(q(el, '.photo-empty')).not.toBeNull();
        });

        test('category chips and search filter the dishes', async () => {
            const el = build();
            await tick();
            await click(el, qa(el, '.chip').find((c) => c.textContent === 'Beverages'));
            expect(text(el)).toContain('Filter Coffee');
            expect(text(el)).not.toContain('Masala Dosa');
            await click(el, qa(el, '.chip').find((c) => c.textContent === 'All'));
            const search = q(el, 'input[type="search"]');
            search.value = 'pongal';
            search.dispatchEvent(new CustomEvent('input'));
            await tick();
            expect(text(el)).toContain('Pongal');
            expect(text(el)).not.toContain('Filter Coffee');
        });

        test('failure and empty results show a friendly message', async () => {
            const bad = build({ success: false, message: 'Menu not available' });
            await tick();
            expect(q(bad, '[role="alert"]').textContent).toContain('Menu not available');
            const empty = build({ success: true, categories: [], items: [] });
            await tick();
            expect(text(empty)).toContain('No matching dishes were found.');
        });
    });

    describe('cart', () => {
        test('add, change quantity and remove; the bar shows the estimate', async () => {
            const el = build();
            await tick();
            await click(el, addDish(el, 'Masala Dosa'));
            expect(q(el, '.qty').textContent).toBe('1');
            await click(el, q(el, 'button[aria-label="Add one more Masala Dosa"]'));
            expect(q(el, '.qty').textContent).toBe('2');
            expect(text(el)).toContain('View cart');
            expect(text(el)).toContain('2 items');
            expect(text(el)).toMatch(/180/);
            await click(el, q(el, 'button[aria-label="Remove one Masala Dosa"]'));
            expect(q(el, '.qty').textContent).toBe('1');
            await click(el, q(el, 'button[aria-label="Remove one Masala Dosa"]'));
            expect(q(el, '.bar')).toBeNull();
        });

        test('cart lets the guest add a note and remove a line', async () => {
            const el = build();
            await tick();
            await click(el, addDish(el, 'Masala Dosa'));
            await click(el, q(el, '.bar-btn'));
            const note = q(el, 'input.note');
            note.value = 'less spicy';
            note.dispatchEvent(new CustomEvent('change'));
            await tick();
            await click(el, buttonWith(el, 'Remove'));
            expect(text(el)).toContain('Your cart is empty.');
            expect(buttonWith(el, 'Continue').disabled).toBe(true);
        });
    });

    describe('details', () => {
        test('validates name and a 10-digit Indian mobile number before calling Apex', async () => {
            const el = build();
            await tick();
            await toDetails(el);
            await fillDetails(el, { name: 'A', phone: '12345' });
            await submit(el);
            expect(text(el)).toContain('Please enter your name.');
            expect(text(el)).toContain('Enter a valid 10-digit Indian mobile number.');
            expect(createOrder).not.toHaveBeenCalled();
        });

        test('pressing Enter in the details inputs reviews the order without form submission', async () => {
            const el = build();
            await tick();
            await toDetails(el);
            await fillDetails(el);
            q(el, '[name="customerPhone"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await tick();
            expect(createOrder).toHaveBeenCalledTimes(1);
            expect(q(el, 'form')).toBeNull();
        });

        test('address and pincode appear only for delivery and are validated', async () => {
            const el = build();
            await tick();
            await toDetails(el);
            expect(q(el, '[name="addressLine"]')).toBeNull();
            const radio = q(el, 'input[name="fulfilment"][value="DELIVERY"]');
            radio.checked = true;
            radio.dispatchEvent(new CustomEvent('change'));
            await tick();
            expect(q(el, '[name="addressLine"]')).not.toBeNull();
            expect(q(el, '[name="pincode"]')).not.toBeNull();
            await fillDetails(el);
            await type(el, 'pincode', '999999');
            await type(el, 'addressLine', '12 Temple Street');
            await submit(el);
            expect(text(el)).toContain('We do not deliver to this pincode yet.');
            expect(createOrder).not.toHaveBeenCalled();
        });

        test('sends item ids and quantities only: never a price', async () => {
            const el = build();
            await tick();
            await toPaymentChoice(el);
            const sent = JSON.parse(createOrder.mock.calls[0][0].orderRequestJson);
            expect(sent.items).toEqual([
                { menuItemId: 'd', quantity: 2, notes: null },
                { menuItemId: 'f', quantity: 1, notes: null }
            ]);
            expect(JSON.stringify(sent)).not.toMatch(/price|total/i);
            expect(sent.customerPhone).toBe('9876543210');
        });

        test('shows the backend totals, not the browser estimate, before payment', async () => {
            const el = build();
            await tick();
            await toPaymentChoice(el);
            expect(text(el)).toContain('Order VR1');
            expect(text(el)).toMatch(/231/);
            expect(text(el)).toContain('Card / Netbanking');
            expect(text(el)).toContain('UPI (scan QR)');
        });

        test('a backend error is shown and the guest stays on the details form', async () => {
            createOrder.mockRejectedValue({ body: { message: JSON.stringify({ code: 'VALIDATION_ERROR', message: 'Pincode not served' }) } });
            const el = build();
            await tick();
            await toDetails(el);
            await fillDetails(el);
            await submit(el);
            expect(text(el)).toContain('Pincode not served');
            expect(q(el, '[role="form"]')).not.toBeNull();
        });

        test('dishes that became unavailable are removed from the cart', async () => {
            createOrder.mockRejectedValue({ body: { message: JSON.stringify({ code: 'ITEM_UNAVAILABLE', message: 'Gone', itemIds: ['d'] }) } });
            const el = build();
            await tick();
            await toDetails(el);
            await fillDetails(el);
            await submit(el);
            expect(text(el)).toContain('Some dishes just became unavailable');
            expect(text(el)).toContain('Your cart');
            expect(text(el)).toContain('Filter Coffee');
        });
    });

    describe('payment', () => {
        test('UPI QR: shows the QR, amount and countdown, and polls every 4 seconds', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr.png', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'PENDING_PAYMENT' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            expect(startPayment).toHaveBeenCalledWith({ orderNumber: 'VR1', customerPhone: '9876543210', method: 'UPI_QR' });
            expect(q(el, 'img.qr').src).toBe('https://rzp.io/qr.png');
            expect(text(el)).toContain('Scan with any UPI app');
            expect(text(el)).toContain('Pay exactly');
            expect(text(el)).toMatch(/Expires in \d\d:\d\d/);
            expect(q(el, '[aria-live="polite"]')).not.toBeNull();
            jest.advanceTimersByTime(4000);
            await tick();
            jest.advanceTimersByTime(4000);
            await tick();
            expect(getPaymentStatus).toHaveBeenCalledTimes(2);
        });

        test('SUCCESS appears only when the backend says PAID, then polling stops', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr.png', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'PENDING_PAYMENT' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            jest.advanceTimersByTime(4000);
            await tick();
            expect(text(el)).not.toContain('Order placed');
            expect(q(el, '.success')).toBeNull();

            getPaymentStatus.mockResolvedValue({ status: 'PAID', orderStatus: 'CONFIRMED' });
            jest.advanceTimersByTime(4000);
            await tick();
            expect(q(el, '.success')).not.toBeNull();
            expect(text(el)).toContain('Order placed');
            expect(text(el)).toContain('Order VR1');
            expect(text(el)).toContain('Total paid');
            const calls = getPaymentStatus.mock.calls.length;
            jest.advanceTimersByTime(20000);
            await tick();
            expect(getPaymentStatus.mock.calls.length).toBe(calls);
        });

        test('nothing the browser does can show "Order placed" for an online order', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'CARD', paymentUrl: 'https://rzp.io/i/abc', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'PENDING_PAYMENT' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            expect(text(el)).not.toContain('Order placed');
            await click(el, buttonWith(el, 'Card / Netbanking'));
            expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
            expect(paymentWindow.opener).toBeNull();
            expect(paymentWindow.location.replace).toHaveBeenCalledWith('https://rzp.io/i/abc');
            const link = q(el, 'a.btn');
            expect(link.href).toBe('https://rzp.io/i/abc');
            expect(link.rel).toContain('noopener');
            jest.advanceTimersByTime(60000);
            await tick();
            expect(text(el)).not.toContain('Order placed');
            expect(buttonWith(el, 'I have paid')).toBeUndefined();
        });

        test('an unsafe payment URL is never navigated to or linked', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'CARD', paymentUrl: 'javascript:alert(1)', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'PENDING_PAYMENT' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'Card / Netbanking'));
            expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
            expect(paymentWindow.location.replace).not.toHaveBeenCalled();
            expect(paymentWindow.close).toHaveBeenCalled();
            expect(q(el, 'a.btn')).toBeNull();
        });

        test('the payment link remains clickable if the browser blocks opening a new tab', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'CARD', paymentUrl: 'https://rzp.io/i/abc', expiresAt: IN_TEN_MIN() });
            window.open.mockReturnValue(null);
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'Card / Netbanking'));
            expect(q(el, 'a.btn').href).toBe('https://rzp.io/i/abc');
        });

        test('an expired QR shows EXPIRED with Try again, which creates a new QR for the same order', async () => {
            startPayment.mockResolvedValueOnce({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr1.png', expiresAt: new Date(Date.now() + 5000).toISOString() });
            getPaymentStatus.mockResolvedValue({ status: 'EXPIRED' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            jest.advanceTimersByTime(6000);
            await tick();
            expect(text(el)).toContain('Payment time ran out');
            expect(q(el, '.success')).toBeNull();

            startPayment.mockResolvedValueOnce({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr2.png', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'PENDING_PAYMENT' });
            await click(el, buttonWith(el, 'Try again'));
            expect(startPayment).toHaveBeenCalledTimes(2);
            expect(startPayment.mock.calls[1][0].orderNumber).toBe('VR1');
            expect(q(el, 'img.qr').src).toBe('https://rzp.io/qr2.png');
        });

        test('a failed payment shows FAILED with Try again and never success', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr.png', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'FAILED' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            jest.advanceTimersByTime(4000);
            await tick();
            expect(text(el)).toContain('Payment failed');
            expect(buttonWith(el, 'Try again')).toBeDefined();
            expect(text(el)).not.toContain('Order placed');
        });

        test('transient polling errors do not break the card or fake a result', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr.png', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockRejectedValue(new Error('cold start'));
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            jest.advanceTimersByTime(4000);
            await tick();
            expect(q(el, 'img.qr')).not.toBeNull();
            expect(text(el)).not.toContain('Order placed');
        });

        test('polling stops when the card is removed from the page', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr.png', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'PENDING_PAYMENT' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            document.body.removeChild(el);
            jest.advanceTimersByTime(20000);
            await tick();
            expect(getPaymentStatus).not.toHaveBeenCalled();
        });

        test('cancelling shows "cancelled" only if the backend says so', async () => {
            startPayment.mockResolvedValue({ orderNumber: 'VR1', method: 'UPI_QR', qrImageUrl: 'https://rzp.io/qr.png', expiresAt: IN_TEN_MIN() });
            getPaymentStatus.mockResolvedValue({ status: 'PENDING_PAYMENT' });
            cancelOrder.mockResolvedValueOnce({ cancelled: false, message: 'Cannot cancel now' });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            await click(el, buttonWith(el, 'Cancel order'));
            expect(text(el)).toContain('Cannot cancel now');
            expect(text(el)).not.toContain('Order cancelled');
            cancelOrder.mockResolvedValueOnce({ cancelled: true });
            await click(el, buttonWith(el, 'Cancel order'));
            expect(text(el)).toContain('Order cancelled');
        });

        test('a payment start error is shown and the guest can pick again', async () => {
            startPayment.mockRejectedValue({ body: { message: JSON.stringify({ code: 'X', message: 'Could not create the UPI QR.' }) } });
            const el = build();
            await tick();
            await toPaymentChoice(el);
            await click(el, buttonWith(el, 'UPI (scan QR)'));
            expect(text(el)).toContain('Could not create the UPI QR.');
            expect(buttonWith(el, 'UPI (scan QR)')).toBeDefined();
        });
    });

    describe('pay at counter', () => {
        test('a backend-confirmed counter order shows a confirmation without any payment step', async () => {
            createOrder.mockResolvedValue({ ...ORDER, paymentMethod: 'COD', status: 'CONFIRMED' });
            const el = build();
            await tick();
            await toDetails(el);
            await fillDetails(el);
            const radio = q(el, 'input[name="paymentMethod"][value="COD"]');
            radio.checked = true;
            radio.dispatchEvent(new CustomEvent('change'));
            await tick();
            await submit(el);
            expect(text(el)).toContain('Order placed');
            expect(text(el)).toContain('Pay at the counter');
            expect(text(el)).toContain('Total to pay');
            expect(startPayment).not.toHaveBeenCalled();
        });
    });

    test('every label comes from labels.js (a changed label changes the markup)', async () => {
        const { LABELS } = require('../labels');
        const el = build();
        await tick();
        expect(q(el, 'input[type="search"]').placeholder).toBe(LABELS.searchPlaceholder);
    });
});
