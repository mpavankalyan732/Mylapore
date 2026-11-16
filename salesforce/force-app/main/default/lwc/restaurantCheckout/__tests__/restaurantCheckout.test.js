import { createElement } from 'lwc';
import RestaurantCheckout from 'c/restaurantCheckout';
import placeOrder from '@salesforce/apex/RestaurantOrderController.placeOrder';

jest.mock('@salesforce/apex/RestaurantOrderController.placeOrder', () => ({ default: jest.fn() }), { virtual: true });

const flush = () => new Promise((r) => setTimeout(r, 0));
const dosa = { id: 'd', name: 'Masala Dosa', price: 90, currencyCode: 'INR', isAvailable: true };
const CONFIG = { taxPercent: 5, deliveryFee: 30, servicePincodes: ['517501'], fulfilmentOptions: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'], paymentMethods: ['ONLINE', 'COD'] };

function build(props = {}) {
    const el = createElement('c-restaurant-checkout', { is: RestaurantCheckout });
    Object.assign(el, { lines: [{ item: dosa, quantity: 2, notes: 'less spicy' }], config: CONFIG }, props);
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
async function choose(el, name, value) {
    const radio = q(el, `input[name="${name}"][value="${value}"]`);
    radio.checked = true;
    radio.dispatchEvent(new CustomEvent('change'));
    await flush();
}
const submit = async (el) => {
    q(el, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
};
async function fillBasics(el) {
    await type(el, 'customerName', 'Asha');
    await type(el, 'customerPhone', '98765 43210');
}

describe('c-restaurant-checkout', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    test('offers only the order types and payment methods the backend supports', () => {
        const el = build({ config: { ...CONFIG, fulfilmentOptions: ['DINE_IN', 'TAKEAWAY'], paymentMethods: ['ONLINE'] } });
        const values = [...el.shadowRoot.querySelectorAll('input[type=radio]')].map((r) => r.value);
        expect(values).toEqual(['DINE_IN', 'TAKEAWAY', 'ONLINE']);
    });

    test('invalid details show errors and never call the API', async () => {
        const el = build();
        await submit(el);
        expect(placeOrder).not.toHaveBeenCalled();
        expect(el.shadowRoot.textContent).toContain('Please enter your name');
        expect(el.shadowRoot.textContent).toContain('valid 10-digit Indian mobile number');
    });

    test('submits exactly what the backend needs and NO prices', async () => {
        placeOrder.mockResolvedValue({ success: true, orderNumber: 'VR1', total: 189 });
        const el = build();
        const placed = jest.fn();
        el.addEventListener('placed', placed);
        await fillBasics(el);
        await choose(el, 'fulfilment', 'TAKEAWAY');
        await choose(el, 'paymentMethod', 'COD');
        await submit(el);

        expect(placeOrder).toHaveBeenCalledTimes(1);
        const { orderRequest } = placeOrder.mock.calls[0][0];
        expect(orderRequest.customerName).toBe('Asha');
        expect(orderRequest.customerPhone).toBe('9876543210');
        expect(orderRequest.fulfilment).toBe('TAKEAWAY');
        expect(orderRequest.paymentMethod).toBe('COD');
        expect(orderRequest.items).toEqual([{ menuItemId: 'd', quantity: 2, notes: 'less spicy' }]);
        expect(JSON.stringify(orderRequest)).not.toMatch(/price|total|amount/i);
        expect(orderRequest.idempotencyKey).toBeTruthy();
        expect(orderRequest.deliveryAddressLine).toBeNull();
        expect(placed).toHaveBeenCalledTimes(1);
        expect(placed.mock.calls[0][0].detail.order.orderNumber).toBe('VR1');
        expect(placed.mock.calls[0][0].detail.phone).toBe('9876543210');
    });

    test('a double submit sends only one request', async () => {
        let resolve;
        placeOrder.mockReturnValue(new Promise((r) => (resolve = r)));
        const el = build();
        await fillBasics(el);
        q(el, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
        q(el, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
        await flush();
        expect(placeOrder).toHaveBeenCalledTimes(1);
        expect(q(el, 'button[type=submit]').disabled).toBe(true);
        resolve({ success: true, orderNumber: 'VR1' });
        await flush();
        expect(q(el, 'button[type=submit]').disabled).toBe(false);
    });

    test('delivery needs an address and a serviceable pincode', async () => {
        const el = build();
        await fillBasics(el);
        await choose(el, 'fulfilment', 'DELIVERY');
        await submit(el);
        expect(placeOrder).not.toHaveBeenCalled();
        expect(el.shadowRoot.textContent).toContain('Enter your delivery address');

        await type(el, 'addressLine', '12 Temple Street');
        await type(el, 'pincode', '560001');
        expect(el.shadowRoot.textContent).toContain('We do not deliver to this pincode yet');
        await submit(el);
        expect(placeOrder).not.toHaveBeenCalled();

        await type(el, 'pincode', '517501');
        expect(el.shadowRoot.textContent).toContain('We deliver to this pincode');
        placeOrder.mockResolvedValue({ success: true, orderNumber: 'VR2' });
        await submit(el);
        const { orderRequest } = placeOrder.mock.calls[0][0];
        expect(orderRequest.deliveryAddressLine).toBe('12 Temple Street');
        expect(orderRequest.deliveryPincode).toBe('517501');
    });

    test('shows the delivery fee in the estimate only for delivery', async () => {
        const el = build();
        expect(el.shadowRoot.textContent).not.toContain('Delivery fee');
        await choose(el, 'fulfilment', 'DELIVERY');
        expect(el.shadowRoot.textContent).toContain('Delivery fee');
    });

    test('ITEM_UNAVAILABLE is reported and the dishes are flagged for the cart', async () => {
        placeOrder.mockRejectedValue({ body: { message: JSON.stringify({ code: 'ITEM_UNAVAILABLE', message: 'Some items are no longer available', itemIds: ['d'] }) } });
        const el = build();
        const unavailable = jest.fn();
        const placed = jest.fn();
        el.addEventListener('unavailable', unavailable);
        el.addEventListener('placed', placed);
        await fillBasics(el);
        await submit(el);
        expect(placed).not.toHaveBeenCalled();
        expect(unavailable.mock.calls[0][0].detail.itemIds).toEqual(['d']);
        expect(q(el, '.alert-error').textContent).toContain('no longer available');
    });

    test('after a lost connection the SAME idempotency key is reused, so a retry cannot duplicate the order', async () => {
        placeOrder.mockRejectedValueOnce({ body: { message: JSON.stringify({ code: 'UNREACHABLE', message: 'Could not be reached' }) } });
        placeOrder.mockResolvedValueOnce({ success: true, orderNumber: 'VR3' });
        const el = build();
        await fillBasics(el);
        await submit(el);
        await submit(el);
        expect(placeOrder).toHaveBeenCalledTimes(2);
        expect(placeOrder.mock.calls[1][0].orderRequest.idempotencyKey).toBe(placeOrder.mock.calls[0][0].orderRequest.idempotencyKey);
    });

    test('after a normal rejection the next attempt uses a fresh key', async () => {
        placeOrder.mockRejectedValueOnce({ body: { message: JSON.stringify({ code: 'DELIVERY_OUT_OF_AREA', message: 'No' }) } });
        placeOrder.mockResolvedValueOnce({ success: true, orderNumber: 'VR4' });
        const el = build();
        await fillBasics(el);
        await submit(el);
        await submit(el);
        expect(placeOrder.mock.calls[1][0].orderRequest.idempotencyKey).not.toBe(placeOrder.mock.calls[0][0].orderRequest.idempotencyKey);
    });

    test('Back emits back', () => {
        const el = build();
        const back = jest.fn();
        el.addEventListener('back', back);
        q(el, '.btn-link').click();
        expect(back).toHaveBeenCalled();
    });
});
