import { createElement } from 'lwc';
import RestaurantItemCard from 'c/restaurantItemCard';

const ITEM = {
    id: 'item-1',
    name: 'Masala Dosa',
    description: 'Crisp crepe',
    price: 90,
    currencyCode: 'INR',
    isAvailable: true,
    isBestseller: true,
    isVegan: true,
    imageUrl: 'https://example.com/dosa.jpg',
    customizations: []
};

function build(props) {
    const el = createElement('c-restaurant-item-card', { is: RestaurantItemCard });
    Object.assign(el, props);
    document.body.appendChild(el);
    return el;
}
const q = (el, sel) => el.shadowRoot.querySelector(sel);

describe('c-restaurant-item-card', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    test('shows name, price, badges and an https image', () => {
        const el = build({ item: ITEM, quantity: 0 });
        expect(q(el, '.name').textContent).toBe('Masala Dosa');
        expect(q(el, '.price').textContent).toMatch(/90/);
        expect(q(el, '.ribbon')).not.toBeNull();
        expect(q(el, 'img.photo').src).toBe('https://example.com/dosa.jpg');
        expect(el.shadowRoot.textContent).toContain('Vegan');
    });

    test('never renders a non-https image', () => {
        const el = build({ item: { ...ITEM, imageUrl: 'http://insecure.example.com/x.jpg' }, quantity: 0 });
        expect(q(el, 'img.photo')).toBeNull();
        expect(q(el, '.placeholder')).not.toBeNull();
    });

    test('Add button emits add with the item id', () => {
        const el = build({ item: ITEM, quantity: 0 });
        const handler = jest.fn();
        el.addEventListener('add', handler);
        q(el, 'button.btn').click();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({ itemId: 'item-1' });
    });

    test('in cart: shows a stepper that emits increase and decrease', () => {
        const el = build({ item: ITEM, quantity: 2 });
        expect(q(el, '.stepper output').textContent).toBe('2');
        const inc = jest.fn();
        const dec = jest.fn();
        el.addEventListener('increase', inc);
        el.addEventListener('decrease', dec);
        const [minus, plus] = el.shadowRoot.querySelectorAll('.stepper button');
        plus.click();
        minus.click();
        expect(inc).toHaveBeenCalledTimes(1);
        expect(dec).toHaveBeenCalledTimes(1);
    });

    test('plus is disabled at the backend limit of 50', () => {
        const el = build({ item: ITEM, quantity: 50 });
        const plus = el.shadowRoot.querySelectorAll('.stepper button')[1];
        expect(plus.disabled).toBe(true);
    });

    test('unavailable dishes cannot be added', () => {
        const el = build({ item: { ...ITEM, isAvailable: false }, quantity: 0 });
        expect(el.shadowRoot.textContent).toContain('Currently unavailable');
        const btn = q(el, 'button.btn');
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toBe('Unavailable');
    });

    test('clicking the photo or name emits view', () => {
        const el = build({ item: ITEM, quantity: 0 });
        const handler = jest.fn();
        el.addEventListener('view', handler);
        q(el, 'button.media').click();
        q(el, 'button.name').click();
        expect(handler).toHaveBeenCalledTimes(2);
    });
});
