import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMenu from '@salesforce/apex/RestaurantMenuController.getMenu';
import getConfig from '@salesforce/apex/RestaurantMenuController.getConfig';
import getItemDetails from '@salesforce/apex/RestaurantMenuController.getItemDetails';
import { formatCurrency, matchesSearch, parseApexError, round2 } from 'c/restaurantUtils';

const PAGE_SIZE = 24;
const MAX_QTY = 50;

/**
 * Restaurant ordering experience. Everything shown (categories, subcategories, dishes, prices, availability,
 * tax/delivery rules) comes live from the restaurant API through Apex. Nothing is hard-coded.
 */
export default class RestaurantOrdering extends LightningElement {
    @api heading = 'Mylapore Restaurant';

    menu = []; // categories, each with its dishes
    config;
    loading = true;
    error = '';

    selectedCategoryId = '';
    selectedSubcategoryName = '';
    searchText = '';
    visibleCount = PAGE_SIZE;
    searchTimer;

    cart = []; // [{ item, quantity, notes }]

    view = 'menu'; // menu | cart | checkout | confirmation | orders
    detailItem;
    detailExtra;
    detailLoading = false;
    detailError = '';

    lastOrder;
    lookupOrderNumber = '';
    lookupPhone = '';
    autoLookup = false;

    connectedCallback() {
        this.load();
    }

    disconnectedCallback() {
        clearTimeout(this.searchTimer);
    }

    // ------------------------------------------------------------------ data

    async load() {
        this.loading = true;
        this.error = '';
        try {
            const [menu, config] = await Promise.all([
                getMenu({ category: null, subcategory: null, searchText: null, includeUnavailable: true }),
                getConfig().catch(() => undefined) // charges are informational; the menu still works without them
            ]);
            this.menu = menu?.categories || [];
            this.config = config;
            this.syncCartWithMenu();
        } catch (err) {
            this.error = parseApexError(err).message;
        } finally {
            this.loading = false;
        }
    }

    handleRetry() {
        this.load();
    }

    get allItems() {
        return this.menu.flatMap((c) => c.items || []);
    }

    /** After a refresh, make cart lines reflect the latest price and availability. */
    syncCartWithMenu() {
        const byId = new Map(this.allItems.map((i) => [i.id, i]));
        this.cart = this.cart.map((l) => ({ ...l, item: byId.get(l.item.id) || { ...l.item, isAvailable: false } }));
    }

    // ------------------------------------------------------------------ views / nav

    get isMenuView() {
        return this.view === 'menu';
    }
    get isCartView() {
        return this.view === 'cart';
    }
    get isCheckoutView() {
        return this.view === 'checkout';
    }
    get isConfirmationView() {
        return this.view === 'confirmation';
    }
    get isOrdersView() {
        return this.view === 'orders';
    }
    get menuTabClass() {
        return 'tab' + (this.isMenuView ? ' tab-on' : '');
    }
    get ordersTabClass() {
        return 'tab' + (this.isOrdersView ? ' tab-on' : '');
    }
    get cartTabClass() {
        return 'tab' + (this.isCartView || this.isCheckoutView ? ' tab-on' : '');
    }
    get menuCurrent() {
        return this.isMenuView ? 'page' : null;
    }
    get ordersCurrent() {
        return this.isOrdersView ? 'page' : null;
    }
    get cartCurrent() {
        return this.isCartView || this.isCheckoutView ? 'page' : null;
    }

    showMenu() {
        this.view = 'menu';
    }
    showCart() {
        this.view = 'cart';
    }
    showOrders() {
        this.autoLookup = false;
        this.view = 'orders';
    }

    // ------------------------------------------------------------------ filters, search, lazy loading

    get categoryPills() {
        const all = {
            id: '',
            label: `All (${this.allItems.length})`,
            pressed: this.selectedCategoryId === '' ? 'true' : 'false',
            cssClass: 'pill' + (this.selectedCategoryId === '' ? ' pill-on' : '')
        };
        const pills = this.menu.map((c) => ({
            id: c.id,
            label: `${c.name} (${(c.items || []).length})`,
            pressed: this.selectedCategoryId === c.id ? 'true' : 'false',
            cssClass: 'pill' + (this.selectedCategoryId === c.id ? ' pill-on' : '')
        }));
        return [all, ...pills];
    }

    get selectedCategory() {
        return this.menu.find((c) => c.id === this.selectedCategoryId);
    }

    get hasSubcategories() {
        return (this.selectedCategory?.subcategories || []).length > 0;
    }

    get subcategoryPills() {
        const subs = this.selectedCategory?.subcategories || [];
        const all = {
            id: '',
            label: 'All',
            pressed: this.selectedSubcategoryName === '' ? 'true' : 'false',
            cssClass: 'pill' + (this.selectedSubcategoryName === '' ? ' pill-on' : '')
        };
        return [
            all,
            ...subs.map((s) => ({
                id: s.name,
                label: s.name,
                pressed: this.selectedSubcategoryName === s.name ? 'true' : 'false',
                cssClass: 'pill' + (this.selectedSubcategoryName === s.name ? ' pill-on' : '')
            }))
        ];
    }

    get filteredItems() {
        return this.allItems.filter((i) => {
            if (this.selectedCategoryId && i.categoryId !== this.selectedCategoryId) {
                return false;
            }
            if (this.selectedSubcategoryName && i.subcategory !== this.selectedSubcategoryName) {
                return false;
            }
            return matchesSearch(i, this.searchText);
        });
    }

    get visibleItems() {
        return this.filteredItems.slice(0, this.visibleCount).map((item) => ({ key: item.id, item, quantity: this.qtyOf(item.id) }));
    }
    get hasMore() {
        return this.filteredItems.length > this.visibleCount;
    }
    get isEmpty() {
        return this.filteredItems.length === 0;
    }
    get resultsText() {
        const n = this.filteredItems.length;
        return `${n} ${n === 1 ? 'dish' : 'dishes'}`;
    }

    handleCategory(event) {
        this.selectedCategoryId = event.currentTarget.dataset.id;
        this.selectedSubcategoryName = '';
        this.visibleCount = PAGE_SIZE;
    }
    handleSubcategory(event) {
        this.selectedSubcategoryName = event.currentTarget.dataset.id;
        this.visibleCount = PAGE_SIZE;
    }
    handleSearch(event) {
        const value = event.target.value;
        clearTimeout(this.searchTimer);
        // Debouncing keystrokes is a legitimate use of a timer.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.searchTimer = setTimeout(() => {
            this.searchText = value;
            this.visibleCount = PAGE_SIZE;
        }, 250); // debounce
    }
    handleShowMore() {
        this.visibleCount += PAGE_SIZE;
    }

    // ------------------------------------------------------------------ cart

    get hasCart() {
        return this.cart.length > 0;
    }
    get cartCount() {
        return this.cart.reduce((n, l) => n + l.quantity, 0);
    }
    get cartTotalText() {
        const total = round2(this.cart.reduce((s, l) => s + l.item.price * l.quantity, 0));
        return formatCurrency(total, this.cart[0]?.item?.currencyCode);
    }

    qtyOf(itemId) {
        return this.cart.find((l) => l.item.id === itemId)?.quantity || 0;
    }

    findItem(itemId) {
        return this.allItems.find((i) => i.id === itemId);
    }

    addItem(item, quantity = 1, notes = '') {
        if (!item || item.isAvailable === false) {
            return;
        }
        const existing = this.cart.find((l) => l.item.id === item.id);
        if (existing) {
            this.cart = this.cart.map((l) => {
                if (l.item.id !== item.id) {
                    return l;
                }
                const merged = notes && !(l.notes || '').includes(notes) ? [l.notes, notes].filter(Boolean).join('; ') : l.notes;
                return { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity), notes: merged };
            });
        } else {
            this.cart = [...this.cart, { item, quantity: Math.min(MAX_QTY, quantity), notes }];
        }
    }

    toast(title, message, variant = 'success') {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    handleAdd(event) {
        const item = this.findItem(event.detail.itemId);
        this.addItem(item);
        if (item) {
            this.toast('Added to cart', item.name);
        }
    }
    handleIncrease(event) {
        const item = this.findItem(event.detail.itemId) || this.cart.find((l) => l.item.id === event.detail.itemId)?.item;
        this.addItem(item);
    }
    handleDecrease(event) {
        const id = event.detail.itemId;
        this.cart = this.cart.flatMap((l) => (l.item.id !== id ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []));
    }
    handleRemove(event) {
        this.cart = this.cart.filter((l) => l.item.id !== event.detail.itemId);
    }
    handleNotes(event) {
        this.cart = this.cart.map((l) => (l.item.id === event.detail.itemId ? { ...l, notes: event.detail.notes } : l));
    }

    // ------------------------------------------------------------------ item detail

    async handleView(event) {
        const item = this.findItem(event.detail.itemId);
        if (!item) {
            return;
        }
        this.detailItem = item;
        this.detailExtra = undefined;
        this.detailError = '';
        this.detailLoading = true;
        try {
            // Refresh with live price/availability and nutrition details
            const result = await getItemDetails({ itemReference: item.id });
            if (this.detailItem?.id === item.id && result?.item) {
                this.detailItem = result.item;
                this.detailExtra = result;
            }
        } catch (err) {
            this.detailError = parseApexError(err).message;
        } finally {
            this.detailLoading = false;
        }
    }
    handleCloseDetail() {
        this.detailItem = undefined;
        this.detailExtra = undefined;
        this.detailError = '';
    }
    handleAddFromModal(event) {
        const { item, quantity, notes } = event.detail;
        this.addItem(item, quantity, notes);
        this.toast('Added to cart', `${quantity} × ${item.name}`);
        this.handleCloseDetail();
    }

    // ------------------------------------------------------------------ checkout / confirmation / tracking

    handleCheckout() {
        if (this.cart.some((l) => l.item.isAvailable === false)) {
            this.toast('Some dishes are unavailable', 'Remove them from your cart to continue.', 'warning');
            return;
        }
        this.view = 'checkout';
    }

    handlePlaced(event) {
        this.lastOrder = event.detail.order;
        this.lookupOrderNumber = event.detail.order?.orderNumber || '';
        this.lookupPhone = event.detail.phone || '';
        this.cart = [];
        this.view = 'confirmation';
        this.toast('Order placed', this.lookupOrderNumber);
    }

    handleUnavailable(event) {
        const ids = new Set(event.detail.itemIds || []);
        const flag = (item) => (ids.has(item.id) ? { ...item, isAvailable: false } : item);
        this.menu = this.menu.map((c) => ({ ...c, items: (c.items || []).map(flag) }));
        this.cart = this.cart.map((l) => ({ ...l, item: flag(l.item) }));
        this.view = 'cart';
        this.toast('Some dishes are no longer available', 'They are marked in your cart. Please remove them.', 'warning');
    }

    handleTrack() {
        this.autoLookup = true;
        this.view = 'orders';
    }
}
