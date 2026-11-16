import { createElement } from 'lwc';
import RestaurantCart from 'c/restaurantCart';

const dosa = { id: 'd', name: 'Masala Dosa', price: 90, currencyCode: 'INR', isAvailable: true, allowsNotes: true };
const pongal = { id: 'p', name: 'Pongal', price: 70, currencyCode: 'INR', isAvailable: true, allowsNotes: true };

function build(props) {
    const el = createElement('c-restaurant-cart', { is: RestaurantCart });
    Object.assign(el, props);
    document.body.appendChild(el);
    return el;
}
const q = (el, sel) => el.shadowRoot.querySelector(sel);

describe('c-restaurant-cart', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    test('empty cart shows a friendly message and no checkout button', () => {
        const el = build({ lines: [] });
        expect(el.shadowRoot.textContent).toContain('Your cart is empty');
        expect(q(el, '.btn')).toBeNull();
    });

    test('shows lines with live prices and totals; tax and delivery fee come from the backend config', () => {
        const el = build({
            lines: [
                { item: dosa, quantity: 2, notes: '' },
                { item: pongal, quantity: 1, notes: '' }
            ],
            config: { taxPercent: 5, deliveryFee: 30 }
        });
        const text = el.shadowRoot.textContent;
        expect(text).toContain('Masala Dosa');
        expect(text).toMatch(/250/); // subtotal 2*90 + 70
        expect(text).toContain('Estimated tax (5%)');
        expect(text).toMatch(/262\.5/); // 250 + 12.5
        expect(text).toMatch(/30/); // delivery fee mentioned in the note
        expect(text).toContain('This is an estimate');
    });

    test('does not invent tax when the backend reports none', () => {
        const el = build({ lines: [{ item: dosa, quantity: 1, notes: '' }], config: { taxPercent: 0, deliveryFee: 0 } });
        expect(el.shadowRoot.textContent).not.toContain('Estimated tax');
    });

    test('emits increase, decrease, remove and notes with the item id', () => {
        const el = build({ lines: [{ item: dosa, quantity: 2, notes: '' }] });
        const events = {};
        ['increase', 'decrease', 'remove', 'notes'].forEach((n) => {
            events[n] = jest.fn();
            el.addEventListener(n, events[n]);
        });
        const [minus, plus] = el.shadowRoot.querySelectorAll('.stepper button');
        plus.click();
        minus.click();
        el.shadowRoot.querySelector('button.btn-link[data-id]').click();
        const input = q(el, '.notes input');
        input.value = 'less spicy';
        input.dispatchEvent(new CustomEvent('change'));
        expect(events.increase.mock.calls[0][0].detail.itemId).toBe('d');
        expect(events.decrease).toHaveBeenCalled();
        expect(events.remove.mock.calls[0][0].detail.itemId).toBe('d');
        expect(events.notes.mock.calls[0][0].detail).toEqual({ itemId: 'd', notes: 'less spicy' });
    });

    test('checkout is blocked while an unavailable dish is in the cart', () => {
        const el = build({ lines: [{ item: { ...dosa, isAvailable: false }, quantity: 1, notes: '' }] });
        expect(el.shadowRoot.textContent).toContain('No longer available');
        const checkout = [...el.shadowRoot.querySelectorAll('button.btn')].find((b) => b.textContent === 'Checkout');
        expect(checkout.disabled).toBe(true);
    });

    test('Checkout button emits checkout', () => {
        const el = build({ lines: [{ item: dosa, quantity: 1, notes: '' }] });
        const handler = jest.fn();
        el.addEventListener('checkout', handler);
        [...el.shadowRoot.querySelectorAll('button.btn')].find((b) => b.textContent === 'Checkout').click();
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
