import { createElement } from 'lwc';
import RestaurantOrdering from 'c/restaurantOrdering';
import getMenu from '@salesforce/apex/RestaurantMenuController.getMenu';
import getConfig from '@salesforce/apex/RestaurantMenuController.getConfig';
import getItemDetails from '@salesforce/apex/RestaurantMenuController.getItemDetails';
import placeOrder from '@salesforce/apex/RestaurantOrderController.placeOrder';

jest.mock('@salesforce/apex/RestaurantMenuController.getMenu', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantMenuController.getConfig', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantMenuController.getItemDetails', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantOrderController.placeOrder', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantOrderController.getOrderDetails', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/RestaurantOrderController.cancelOrder', () => ({ default: jest.fn() }), { virtual: true });

const flush = () => new Promise((r) => setTimeout(r, 0));

const item = (id, name, price, extra = {}) => ({
    id, name, description: `${name} description`, price, currencyCode: 'INR', isAvailable: true, allowsNotes: true, tags: [], customizations: [], ...extra
});
const MENU = {
    success: true,
    categories: [
        {
            id: 'c1', name: 'Idli & Dosa', subcategories: [{ id: 's1', name: 'Dosa' }, { id: 's2', name: 'Idli' }],
            items: [
                item('d', 'Masala Dosa', 90, { categoryId: 'c1', categoryName: 'Idli & Dosa', subcategory: 'Dosa' }),
                item('i', 'Crispy Idli', 60, { categoryId: 'c1', categoryName: 'Idli & Dosa', subcategory: 'Idli' })
            ]
        },
        { id: 'c2', name: 'Desserts', subcategories: [], items: [item('g', 'Gulab Jamun', 80, { categoryId: 'c2', categoryName: 'Desserts' }), item('m', 'Mysore Pak', 70, { categoryId: 'c2', categoryName: 'Desserts', isAvailable: false })] }
    ]
};
const CONFIG = { currencyCode: 'INR', taxPercent: 5, deliveryFee: 30, servicePincodes: ['517501'], fulfilmentOptions: ['TAKEAWAY'], paymentMethods: ['COD'] };

async function build() {
    const el = createElement('c-restaurant-ordering', { is: RestaurantOrdering });
    document.body.appendChild(el);
    await flush();
    await flush();
    return el;
}
const q = (el, sel) => el.shadowRoot.querySelector(sel);
const qa = (el, sel) => [...el.shadowRoot.querySelectorAll(sel)];
const cardNames = (el) => qa(el, 'c-restaurant-item-card').map((c) => c.shadowRoot.querySelector('.name').textContent);
const pill = (el, text) => qa(el, '.pills button').find((b) => b.textContent.startsWith(text));
const tab = (el, text) => qa(el, '.nav button').find((b) => b.textContent.trim().startsWith(text));
const cardFor = (el, name) => qa(el, 'c-restaurant-item-card').find((c) => c.shadowRoot.querySelector('.name').textContent === name);
const plusFromCard = async (el, name) => {
    cardFor(el, name).shadowRoot.querySelectorAll('.stepper button')[1].click();
    await flush();
};
const addFromCard = async (el, name) => {
    qa(el, 'c-restaurant-item-card').find((c) => c.shadowRoot.querySelector('.name').textContent === name).shadowRoot.querySelector('button.btn').click();
    await flush();
};

describe('c-restaurant-ordering', () => {
    beforeEach(() => {
        getMenu.mockResolvedValue(MENU);
        getConfig.mockResolvedValue(CONFIG);
        getItemDetails.mockImplementation(({ itemReference }) => Promise.resolve({ success: true, item: MENU.categories.flatMap((c) => c.items).find((i) => i.id === itemReference), notice: 'Check allergies' }));
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    test('loads the live menu from Apex (nothing hard-coded) and shows every dish', async () => {
        const el = await build();
        expect(getMenu).toHaveBeenCalledWith({ category: null, subcategory: null, searchText: null, includeUnavailable: true });
        expect(cardNames(el)).toEqual(['Masala Dosa', 'Crispy Idli', 'Gulab Jamun', 'Mysore Pak']);
        expect(pill(el, 'All').textContent).toContain('(4)');
        expect(pill(el, 'Idli & Dosa').textContent).toContain('(2)');
        expect(q(el, '.muted.small').textContent).toBe('4 dishes');
    });

    test('shows an error with a retry when the API fails, and recovers on retry', async () => {
        getMenu.mockRejectedValueOnce({ body: { message: JSON.stringify({ code: 'UNREACHABLE', message: 'The restaurant system could not be reached.' }) } });
        const el = await build();
        expect(q(el, '.alert-error').textContent).toContain('could not be reached');
        expect(qa(el, 'c-restaurant-item-card')).toHaveLength(0);
        q(el, '.alert-error button').click();
        await flush();
        await flush();
        expect(cardNames(el)).toHaveLength(4);
    });

    test('still works when the charges config cannot be loaded', async () => {
        getConfig.mockRejectedValue(new Error('config down'));
        const el = await build();
        expect(cardNames(el)).toHaveLength(4);
    });

    test('category filter shows only that category and subcategories appear for categories that have them', async () => {
        const el = await build();
        expect(qa(el, '.pills.sub')).toHaveLength(0);
        pill(el, 'Idli & Dosa').click();
        await flush();
        expect(cardNames(el)).toEqual(['Masala Dosa', 'Crispy Idli']);
        const subs = qa(el, '.pills.sub button').map((b) => b.textContent);
        expect(subs).toEqual(['All', 'Dosa', 'Idli']);

        qa(el, '.pills.sub button').find((b) => b.textContent === 'Dosa').click();
        await flush();
        expect(cardNames(el)).toEqual(['Masala Dosa']);

        pill(el, 'Desserts').click();
        await flush();
        expect(qa(el, '.pills.sub')).toHaveLength(0); // categories without subcategories are supported
        expect(cardNames(el)).toEqual(['Gulab Jamun', 'Mysore Pak']);
    });

    test('search is debounced and filters by name or description', async () => {
        const el = await build();
        jest.useFakeTimers(); // after the async setup, which relies on real timers
        const input = q(el, 'input[type=search]');
        input.value = 'jamun';
        input.dispatchEvent(new CustomEvent('input'));
        expect(cardNames(el)).toHaveLength(4); // not applied yet
        jest.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
        expect(cardNames(el)).toEqual(['Gulab Jamun']);

        input.value = 'zzzz';
        input.dispatchEvent(new CustomEvent('input'));
        jest.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
        expect(el.shadowRoot.textContent).toContain('No dishes match your search');
    });

    test('adding to the cart updates the badge; unavailable dishes cannot be added', async () => {
        const el = await build();
        await addFromCard(el, 'Masala Dosa');
        await addFromCard(el, 'Crispy Idli');
        expect(tab(el, 'Cart').textContent).toMatch(/Cart\s+·\s+2\s+·/);
        const mysore = qa(el, 'c-restaurant-item-card').find((c) => c.shadowRoot.querySelector('.name').textContent === 'Mysore Pak');
        expect(mysore.shadowRoot.querySelector('button.btn').disabled).toBe(true);
    });

    test('cart view lets the customer change quantity and remove items; totals follow', async () => {
        const el = await build();
        await addFromCard(el, 'Masala Dosa');
        tab(el, 'Cart').click();
        await flush();
        const cart = q(el, 'c-restaurant-cart');
        expect(cart.shadowRoot.textContent).toContain('Masala Dosa');
        const [, plus] = cart.shadowRoot.querySelectorAll('.stepper button');
        plus.click();
        await flush();
        expect(cart.shadowRoot.querySelector('.stepper output').textContent).toBe('2');
        expect(cart.shadowRoot.textContent).toMatch(/180/);
        cart.shadowRoot.querySelectorAll('.stepper button')[0].click();
        cart.shadowRoot.querySelectorAll('.stepper button')[0].click();
        await flush();
        expect(cart.shadowRoot.textContent).toContain('Your cart is empty');
    });

    test('item details open in a dialog with live data and add the chosen quantity', async () => {
        const el = await build();
        qa(el, 'c-restaurant-item-card')[0].shadowRoot.querySelector('button.name').click();
        await flush();
        await flush();
        expect(getItemDetails).toHaveBeenCalledWith({ itemReference: 'd' });
        const modal = q(el, 'c-restaurant-item-modal');
        expect(modal).not.toBeNull();
        expect(modal.shadowRoot.querySelector('h2.title').textContent).toBe('Masala Dosa');
        modal.shadowRoot.querySelectorAll('.stepper button')[1].click(); // quantity 2
        await flush();
        const notes = modal.shadowRoot.querySelector('textarea');
        notes.value = 'no onion';
        notes.dispatchEvent(new CustomEvent('change'));
        modal.shadowRoot.querySelector('.btn').click();
        await flush();
        expect(q(el, 'c-restaurant-item-modal')).toBeNull();
        expect(tab(el, 'Cart').textContent).toMatch(/·\s+2\s+·/);
        tab(el, 'Cart').click();
        await flush();
        expect(q(el, 'c-restaurant-cart').shadowRoot.querySelector('.notes input').value).toBe('no onion');
    });

    test('Escape closes the item dialog', async () => {
        const el = await build();
        qa(el, 'c-restaurant-item-card')[0].shadowRoot.querySelector('button.media').click();
        await flush();
        await flush();
        const modal = q(el, 'c-restaurant-item-modal');
        modal.shadowRoot.querySelector('[role=dialog]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flush();
        expect(q(el, 'c-restaurant-item-modal')).toBeNull();
    });

    test('full flow: cart, checkout, order placed, confirmation shows the backend result and the cart is emptied', async () => {
        placeOrder.mockResolvedValue({
            success: true, orderNumber: 'VR261111-AB12CD', status: 'CONFIRMED', paymentStatus: 'COD_PENDING', currencyCode: 'INR',
            subtotal: 180, tax: 9, deliveryFee: 0, total: 189, items: [{ menuItemId: 'd', name: 'Masala Dosa', quantity: 2, lineTotal: 180 }], confirmation: 'Confirmed.'
        });
        const el = await build();
        await addFromCard(el, 'Masala Dosa');
        await plusFromCard(el, 'Masala Dosa'); // the Add button became a stepper
        tab(el, 'Cart').click();
        await flush();
        [...q(el, 'c-restaurant-cart').shadowRoot.querySelectorAll('button.btn')].find((b) => b.textContent === 'Checkout').click();
        await flush();

        const checkout = q(el, 'c-restaurant-checkout');
        const set = async (name, value) => {
            const input = checkout.shadowRoot.querySelector(`[name="${name}"]`);
            input.value = value;
            input.dispatchEvent(new CustomEvent('change'));
            await flush();
        };
        await set('customerName', 'Asha');
        await set('customerPhone', '9876543210');
        checkout.shadowRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
        await flush();
        await flush();

        expect(placeOrder).toHaveBeenCalledTimes(1);
        expect(placeOrder.mock.calls[0][0].orderRequest.items).toEqual([{ menuItemId: 'd', quantity: 2, notes: null }]);
        const result = q(el, 'c-restaurant-order-result');
        expect(result).not.toBeNull();
        expect(result.shadowRoot.textContent).toContain('VR261111-AB12CD');
        expect(result.shadowRoot.textContent).toMatch(/189/);
        expect(tab(el, 'Cart').textContent.trim()).toBe('Cart');
    });

    test('if the backend says a dish is unavailable at checkout, the cart marks it and checkout is blocked', async () => {
        placeOrder.mockRejectedValue({ body: { message: JSON.stringify({ code: 'ITEM_UNAVAILABLE', message: 'Gone', itemIds: ['d'] }) } });
        const el = await build();
        await addFromCard(el, 'Masala Dosa');
        tab(el, 'Cart').click();
        await flush();
        [...q(el, 'c-restaurant-cart').shadowRoot.querySelectorAll('button.btn')].find((b) => b.textContent === 'Checkout').click();
        await flush();
        const checkout = q(el, 'c-restaurant-checkout');
        for (const [name, value] of [['customerName', 'Asha'], ['customerPhone', '9876543210']]) {
            const input = checkout.shadowRoot.querySelector(`[name="${name}"]`);
            input.value = value;
            input.dispatchEvent(new CustomEvent('change'));
            await flush();
        }
        checkout.shadowRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
        await flush();
        await flush();
        const cart = q(el, 'c-restaurant-cart');
        expect(cart).not.toBeNull();
        expect(cart.shadowRoot.textContent).toContain('No longer available');
        const checkoutBtn = [...cart.shadowRoot.querySelectorAll('button.btn')].find((b) => b.textContent === 'Checkout');
        expect(checkoutBtn.disabled).toBe(true);
    });

    test('My orders opens the order lookup', async () => {
        const el = await build();
        tab(el, 'My orders').click();
        await flush();
        expect(q(el, 'c-restaurant-order-lookup')).not.toBeNull();
    });
});
