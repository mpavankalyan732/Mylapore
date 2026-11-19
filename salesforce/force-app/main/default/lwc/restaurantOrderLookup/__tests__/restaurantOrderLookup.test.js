import { createElement } from 'lwc';
import RestaurantOrderLookup from 'c/restaurantOrderLookup';
import getOrderDetails from '@salesforce/apex/RestaurantOrderController.getOrderDetails';
import cancelOrder from '@salesforce/apex/RestaurantOrderController.cancelOrder';

jest.mock('@salesforce/apex/RestaurantOrderController.getOrderDetails', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantOrderController.cancelOrder', () => ({ default: jest.fn() }), { virtual: true });

const flush = () => new Promise((r) => setTimeout(r, 0));
const DETAILS = {
    success: true, orderNumber: 'VR1', status: 'CONFIRMED', statusMessage: 'Confirmed', paymentStatus: 'COD_PENDING', paymentMethod: 'COD',
    fulfilment: 'TAKEAWAY', currencyCode: 'INR', total: 189, subtotal: 180, tax: 9, deliveryFee: 0, items: [], cancellable: true, cancellableReason: 'Not started'
};

function build(props = {}) {
    const el = createElement('c-restaurant-order-lookup', { is: RestaurantOrderLookup });
    Object.assign(el, props);
    document.body.appendChild(el);
    return el;
}
const q = (el, sel) => el.shadowRoot.querySelector(sel);
async function type(el, name, value) {
    const input = q(el, `[name="${name}"]`);
    input.value = value;
    input.dispatchEvent(new CustomEvent('change'));
    await flush();
}
async function lookup(el) {
    await type(el, 'orderNumber', 'VR1');
    await type(el, 'phone', '9876543210');
    q(el, '[data-id="submit"]').click();
    await flush();
}
const cancelButton = (el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent === 'Cancel this order');

describe('c-restaurant-order-lookup', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    test('requires both order number and phone', async () => {
        const el = build();
        q(el, '[data-id="submit"]').click();
        await flush();
        expect(getOrderDetails).not.toHaveBeenCalled();
        expect(q(el, '.alert-error').textContent).toContain('Enter your order number');
    });

    test('shows the real order details', async () => {
        getOrderDetails.mockResolvedValue(DETAILS);
        const el = build();
        await lookup(el);
        expect(getOrderDetails).toHaveBeenCalledWith({ orderNumber: 'VR1', customerPhone: '9876543210' });
        expect(q(el, 'c-restaurant-order-details-view')).not.toBeNull();
        expect(cancelButton(el)).toBeDefined();
    });

    test('Enter in either lookup field runs the lookup', async () => {
        getOrderDetails.mockResolvedValue(DETAILS);
        const el = build();
        await type(el, 'orderNumber', 'VR1');
        await type(el, 'phone', '9876543210');
        q(el, '[name="phone"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await flush();
        expect(getOrderDetails).toHaveBeenCalledWith({ orderNumber: 'VR1', customerPhone: '9876543210' });
    });

    test('an unknown order or wrong phone gives a generic not-found message', async () => {
        getOrderDetails.mockRejectedValue({ body: { message: JSON.stringify({ code: 'NOT_FOUND', message: 'Order not found' }) } });
        const el = build();
        await lookup(el);
        expect(q(el, '.alert-error').textContent).toContain('No order was found for that order number and phone number.');
        expect(q(el, 'c-restaurant-order-details-view')).toBeNull();
    });

    test('autoLookup with a prefill looks up immediately (used right after placing an order)', async () => {
        getOrderDetails.mockResolvedValue(DETAILS);
        build({ orderNumber: 'VR1', phone: '9876543210', autoLookup: true });
        await flush();
        expect(getOrderDetails).toHaveBeenCalledTimes(1);
    });

    test('cancel asks for confirmation first and "Keep my order" does nothing', async () => {
        getOrderDetails.mockResolvedValue(DETAILS);
        const el = build();
        await lookup(el);
        cancelButton(el).click();
        await flush();
        expect(q(el, '[role=alertdialog]')).not.toBeNull();
        expect(cancelOrder).not.toHaveBeenCalled();
        q(el, '[data-focus]').click();
        await flush();
        expect(q(el, '[role=alertdialog]')).toBeNull();
        expect(cancelOrder).not.toHaveBeenCalled();
    });

    test('confirmed cancel calls Apex with confirmed=true, reports success only when the backend did, and refreshes the status', async () => {
        getOrderDetails.mockResolvedValueOnce(DETAILS);
        getOrderDetails.mockResolvedValueOnce({ ...DETAILS, status: 'CANCELLED', cancellable: false });
        cancelOrder.mockResolvedValue({ success: true, cancelled: true, message: 'Order cancelled.' });
        const el = build();
        await lookup(el);
        cancelButton(el).click();
        await flush();
        [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent === 'Yes, cancel it').click();
        await flush();
        await flush();
        expect(cancelOrder).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: 'VR1', customerPhone: '9876543210', confirmed: true }));
        expect(getOrderDetails).toHaveBeenCalledTimes(2);
        expect(q(el, '.alert-ok').textContent).toContain('Order cancelled');
        expect(cancelButton(el)).toBeUndefined();
    });

    test('when the backend refuses (kitchen started) the page does NOT claim the order is cancelled', async () => {
        getOrderDetails.mockResolvedValue(DETAILS);
        cancelOrder.mockResolvedValue({ success: true, cancelled: false, code: 'KITCHEN_STARTED', message: 'The kitchen has already started preparing this order.' });
        const el = build();
        await lookup(el);
        cancelButton(el).click();
        await flush();
        [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent === 'Yes, cancel it').click();
        await flush();
        await flush();
        const notice = q(el, '.alert-info');
        expect(notice.textContent).toContain('already started preparing');
        expect(el.shadowRoot.textContent).not.toContain('Order cancelled');
        expect(q(el, '.alert-ok')).toBeNull();
    });
});
