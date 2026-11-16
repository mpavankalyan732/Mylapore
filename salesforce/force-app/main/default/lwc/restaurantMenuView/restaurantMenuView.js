import { LightningElement, api } from 'lwc';
import placeOrder from '@salesforce/apex/RestaurantOrderController.placeOrder';
import getOrderStatus from '@salesforce/apex/RestaurantOrderController.getOrderStatus';
import cancelOrder from '@salesforce/apex/RestaurantOrderController.cancelOrder';
import getConfig from '@salesforce/apex/RestaurantMenuController.getConfig';
import { formatCurrency, isSafeUrl, newIdempotencyKey, parseApexError, round2, statusLabel } from 'c/restaurantUtils';

const MAX_PER_GROUP = 12; // keep the chat compact
const MAX_QTY = 20;
const PHONE = /^(\+?91)?[6-9]\d{9}$/;
const POLL_MS = 5000;
const POLL_LIMIT = 60; // about 5 minutes
const PAID = ['PAID', 'CAPTURED', 'SUCCESS'];
const PAYMENT_LABELS = { ONLINE: 'Pay online (Razorpay: UPI / cards / netbanking)', COD: 'Pay at counter / on delivery' };
const FULFILMENT_LABELS = { TAKEAWAY: 'Takeaway', DINE_IN: 'Dine-in', DELIVERY: 'Home delivery' };

/**
 * Agentforce renderer for the restaurantMenu Lightning Type.
 * One component, five screens: menu (cards with image + Add), cart, checkout (payment choice),
 * online payment (waits for the signed webhook) and the success screen.
 * Prices shown here are estimates; the backend calculates the real ones and is never sent a price.
 */
export default class RestaurantMenuView extends LightningElement {
    @api value;

    screen = 'menu'; // menu | cart | checkout | pay | done
    cart = {}; // itemId -> { item, quantity }
    config;
    configLoaded = false;

    customerName = '';
    customerPhone = '';
    fulfilment = 'TAKEAWAY';
    paymentMethod = '';
    addressLine = '';
    pincode = '';
    notes = '';
    errors = {};
    error = '';
    submitting = false;
    idempotencyKey = newIdempotencyKey();

    order; // RestaurantOrderResponse after placing
    paid = false;
    pollCount = 0;
    pollTimer;
    cancelling = false;
    cancelled = false;
    info = '';

    disconnectedCallback() {
        this.stopPolling();
    }

    // ------------------------------------------------------------------ screens

    get isMenu() { return this.screen === 'menu'; }
    get isCart() { return this.screen === 'cart'; }
    get isCheckout() { return this.screen === 'checkout'; }
    get isPay() { return this.screen === 'pay'; }
    get isDone() { return this.screen === 'done'; }

    show(screen) {
        this.screen = screen;
        this.error = '';
    }
    goMenu() { this.show('menu'); }
    goCart() { this.show('cart'); }
    goCheckout() {
        this.show('checkout');
        this.loadConfig();
    }

    // ------------------------------------------------------------------ menu data

    get failed() {
        return !this.value || this.value.success === false;
    }
    get hasWarnings() {
        return (this.value?.warnings || []).length > 0;
    }
    get isEmpty() {
        return this.groups.length === 0;
    }
    get currencyCode() {
        return this.value?.currencyCode || this.config?.currencyCode || 'INR';
    }

    toRow(item, currency) {
        const qty = this.cart[item.id]?.quantity || 0;
        const unavailable = item.isAvailable === false;
        return {
            id: item.id,
            name: item.name,
            description: item.description,
            imageUrl: typeof item.imageUrl === 'string' && item.imageUrl.startsWith('https://') ? item.imageUrl : null,
            unavailable,
            canAdd: !unavailable && !!item.id,
            inCart: qty > 0,
            quantity: qty,
            atMax: qty >= MAX_QTY,
            priceText: formatCurrency(item.price, item.currencyCode || currency),
            raw: item
        };
    }

    makeGroup(key, title, items, currency) {
        const shown = items.slice(0, MAX_PER_GROUP).map((i) => this.toRow(i, currency));
        const extra = items.length - shown.length;
        return {
            key,
            title,
            items: shown,
            countText: `${items.length} ${items.length === 1 ? 'dish' : 'dishes'}`,
            moreText: extra > 0 ? `+ ${extra} more. Ask me to narrow it down.` : null
        };
    }

    get groups() {
        const v = this.value || {};
        const groups = [];
        (v.categories || []).forEach((c) => {
            if ((c.items || []).length > 0) {
                groups.push(this.makeGroup(c.id || c.name, c.name, c.items, v.currencyCode));
            } else if (!(v.items || []).length) {
                groups.push({
                    key: c.id || c.name,
                    title: c.name,
                    items: [],
                    countText: `${c.availableItemCount ?? c.itemCount ?? 0} available`,
                    moreText: null
                });
            }
        });
        if ((v.items || []).length > 0) {
            groups.push(this.makeGroup('items', 'Dishes', v.items, v.currencyCode));
        }
        return groups;
    }

    // ------------------------------------------------------------------ cart

    /** Only whole-number quantities within limits; the cart is replaced (not mutated) so the template re-renders. */
    setQuantity(item, quantity) {
        const next = { ...this.cart };
        if (quantity <= 0) {
            delete next[item.id];
        } else {
            next[item.id] = { item, quantity: Math.min(quantity, MAX_QTY) };
        }
        this.cart = next;
        this.info = '';
    }
    findItem(id) {
        return this.cart[id]?.item || this.allItems().find((i) => i.id === id);
    }
    allItems() {
        const v = this.value || {};
        return [...(v.items || []), ...(v.categories || []).flatMap((c) => c.items || [])];
    }
    handleAdd(event) {
        const item = this.findItem(event.currentTarget.dataset.id);
        if (item && item.isAvailable !== false) {
            this.setQuantity(item, (this.cart[item.id]?.quantity || 0) + 1);
        }
    }
    handleInc(event) {
        this.handleAdd(event);
    }
    handleDec(event) {
        const item = this.findItem(event.currentTarget.dataset.id);
        if (item) {
            this.setQuantity(item, (this.cart[item.id]?.quantity || 0) - 1);
        }
    }
    handleRemove(event) {
        const item = this.findItem(event.currentTarget.dataset.id);
        if (item) {
            this.setQuantity(item, 0);
        }
    }
    /** "Cancel" on the menu/cart: discard the whole selection. Nothing has been sent to the backend yet. */
    handleClearCart() {
        this.cart = {};
        this.info = 'Your selection was cleared.';
        this.show('menu');
    }

    get cartLines() {
        return Object.values(this.cart).map(({ item, quantity }) => ({
            id: item.id,
            name: item.name,
            quantity,
            atMax: quantity >= MAX_QTY,
            unitText: formatCurrency(item.price, item.currencyCode || this.currencyCode),
            totalText: formatCurrency(round2(item.price * quantity), item.currencyCode || this.currencyCode),
            imageUrl: typeof item.imageUrl === 'string' && item.imageUrl.startsWith('https://') ? item.imageUrl : null
        }));
    }
    get cartCount() {
        return Object.values(this.cart).reduce((n, l) => n + l.quantity, 0);
    }
    get hasCart() { return this.cartCount > 0; }
    get cartEmpty() { return this.cartCount === 0; }
    get cartButtonLabel() {
        return `View cart (${this.cartCount}) · ${this.subtotalText}`;
    }
    get subtotal() {
        return round2(Object.values(this.cart).reduce((s, l) => s + Number(l.item.price || 0) * l.quantity, 0));
    }
    get subtotalText() { return formatCurrency(this.subtotal, this.currencyCode); }

    // ------------------------------------------------------------------ checkout

    async loadConfig() {
        if (this.configLoaded) {
            return;
        }
        this.configLoaded = true;
        try {
            this.config = await getConfig();
        } catch {
            this.config = undefined; // fall back to safe defaults below; the backend still validates everything
            this.configLoaded = false;
        }
    }

    get fulfilmentValues() {
        const o = this.config?.fulfilmentOptions;
        return o && o.length ? o : ['TAKEAWAY', 'DINE_IN'];
    }
    get paymentValues() {
        const o = this.config?.paymentMethods;
        return o && o.length ? o : ['ONLINE', 'COD'];
    }
    get selectedPayment() {
        return this.paymentValues.includes(this.paymentMethod) ? this.paymentMethod : this.paymentValues[0];
    }
    option(value, labels, selected) {
        return { value, label: labels[value] || value, checked: selected === value, cssClass: 'opt' + (selected === value ? ' opt-on' : '') };
    }
    get fulfilmentOptions() { return this.fulfilmentValues.map((v) => this.option(v, FULFILMENT_LABELS, this.fulfilment)); }
    get paymentOptions() { return this.paymentValues.map((v) => this.option(v, PAYMENT_LABELS, this.selectedPayment)); }
    get isDelivery() { return this.fulfilment === 'DELIVERY'; }
    get isOnline() { return this.selectedPayment === 'ONLINE'; }

    get tax() { return round2((this.subtotal * Number(this.config?.taxPercent || 0)) / 100); }
    get deliveryFee() { return this.isDelivery ? Number(this.config?.deliveryFee || 0) : 0; }
    get showTax() { return this.tax > 0; }
    get showDeliveryFee() { return this.deliveryFee > 0; }
    get taxText() { return formatCurrency(this.tax, this.currencyCode); }
    get deliveryFeeText() { return formatCurrency(this.deliveryFee, this.currencyCode); }
    get estimatedTotalText() { return formatCurrency(round2(this.subtotal + this.tax + this.deliveryFee), this.currencyCode); }
    get submitLabel() {
        if (this.submitting) {
            return 'Placing your order…';
        }
        return this.isOnline ? `Pay ${this.estimatedTotalText}` : `Place order · ${this.estimatedTotalText}`;
    }
    get nameClass() { return this.errors.customerName ? 'bad' : ''; }
    get phoneClass() { return this.errors.customerPhone ? 'bad' : ''; }
    get addressClass() { return this.errors.addressLine ? 'bad' : ''; }
    get pincodeClass() { return this.errors.pincode ? 'bad' : ''; }

    handleField(event) {
        const { name, value } = event.target;
        if (name === 'pincode') {
            this.pincode = value.replace(/\D/g, '').slice(0, 6);
        } else {
            this[name] = value;
        }
    }

    validate() {
        const e = {};
        if (this.customerName.trim().length < 2) {
            e.customerName = 'Please enter your name';
        }
        if (!PHONE.test(this.customerPhone.replace(/[\s-]/g, ''))) {
            e.customerPhone = 'Enter a valid 10-digit Indian mobile number';
        }
        if (this.isDelivery) {
            if (this.addressLine.trim().length < 4) {
                e.addressLine = 'Enter your delivery address';
            }
            if (!/^\d{6}$/.test(this.pincode)) {
                e.pincode = 'Enter a 6-digit pincode';
            } else if (Array.isArray(this.config?.servicePincodes) && this.config.servicePincodes.length && !this.config.servicePincodes.includes(this.pincode)) {
                e.pincode = 'We do not deliver to this pincode yet';
            }
        }
        return e;
    }

    async handlePlaceOrder(event) {
        event.preventDefault();
        if (this.submitting) {
            return; // duplicate-click guard
        }
        this.errors = this.validate();
        if (Object.keys(this.errors).length > 0) {
            this.error = 'Please fix the highlighted fields.';
            return;
        }
        this.error = '';
        this.submitting = true;
        const orderRequest = {
            customerName: this.customerName.trim(),
            customerPhone: this.customerPhone.replace(/[\s-]/g, ''),
            fulfilment: this.fulfilment,
            paymentMethod: this.selectedPayment,
            deliveryAddressLine: this.isDelivery ? this.addressLine.trim() : null,
            deliveryPincode: this.isDelivery ? this.pincode : null,
            notes: this.notes.trim() || null,
            idempotencyKey: this.idempotencyKey,
            // No prices are sent: the restaurant API calculates them.
            items: Object.values(this.cart).map((l) => ({ menuItemId: l.item.id, quantity: l.quantity }))
        };
        try {
            const order = await placeOrder({ orderRequest });
            this.idempotencyKey = newIdempotencyKey();
            this.order = order;
            this.cart = {};
            if (order.nextAction === 'OPEN_CHECKOUT' && isSafeUrl(order.checkoutUrl)) {
                this.show('pay');
                this.startPolling();
            } else {
                this.paid = this.isOrderPaid(order);
                this.show('done');
            }
        } catch (err) {
            const parsed = parseApexError(err);
            this.error = parsed.message;
            if (parsed.code === 'ITEM_UNAVAILABLE') {
                this.dropUnavailable(parsed.itemIds);
            }
            // After a lost connection the order may exist: keep the key so a retry returns it instead of duplicating.
            if (parsed.code !== 'UNREACHABLE') {
                this.idempotencyKey = newIdempotencyKey();
            }
        } finally {
            this.submitting = false;
        }
    }

    dropUnavailable(ids) {
        if (!ids || !ids.length) {
            return;
        }
        const next = { ...this.cart };
        ids.forEach((id) => delete next[id]);
        this.cart = next;
        this.info = 'Some dishes just became unavailable and were removed from your cart.';
        this.show(this.hasCart ? 'cart' : 'menu');
    }

    // ------------------------------------------------------------------ online payment

    get payUrl() {
        return isSafeUrl(this.order?.checkoutUrl) ? this.order.checkoutUrl : null;
    }
    isOrderPaid(o) {
        return PAID.includes(String(o?.paymentStatus || '').toUpperCase()) || o?.status === 'CONFIRMED';
    }
    startPolling() {
        this.stopPolling();
        this.pollCount = 0;
        this.pollTimer = setInterval(() => this.checkPayment(false), POLL_MS);
    }
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
    }
    handleCheckPayment() {
        this.checkPayment(true);
    }
    async checkPayment(manual) {
        if (!this.order?.orderNumber || this.checking) {
            return;
        }
        this.pollCount += 1;
        if (!manual && this.pollCount > POLL_LIMIT) {
            this.stopPolling();
            this.info = 'Still waiting for the payment. Use "I have paid" to check again.';
            return;
        }
        this.checking = true;
        try {
            const s = await getOrderStatus({ orderNumber: this.order.orderNumber, customerPhone: this.customerPhone.replace(/[\s-]/g, '') });
            if (this.isOrderPaid(s)) {
                this.stopPolling();
                this.order = { ...this.order, status: s.status, statusMessage: s.statusMessage, paymentStatus: s.paymentStatus };
                this.paid = true;
                this.show('done');
            } else if (['PAYMENT_FAILED', 'EXPIRED', 'CANCELLED'].includes(s.status)) {
                this.stopPolling();
                this.order = { ...this.order, status: s.status, statusMessage: s.statusMessage };
                this.error = s.statusMessage || statusLabel(s.status);
            } else if (manual) {
                this.info = 'Payment not received yet. Finish paying in the payment window, then try again.';
            }
        } catch (err) {
            if (manual) {
                this.error = parseApexError(err).message;
            }
        } finally {
            this.checking = false;
        }
    }
    checking = false;

    /** Cancel the unpaid order. Always confirmed by the customer first; reported cancelled only if the backend says so. */
    async handleCancelOrder() {
        if (this.cancelling || !this.order?.orderNumber) {
            return;
        }
        this.cancelling = true;
        this.error = '';
        try {
            const r = await cancelOrder({
                orderNumber: this.order.orderNumber,
                customerPhone: this.customerPhone.replace(/[\s-]/g, ''),
                reason: 'Cancelled by customer from the menu card',
                confirmed: true
            });
            if (r && r.cancelled === true) {
                this.stopPolling();
                this.cancelled = true;
                this.paid = false;
                this.show('done');
            } else {
                this.error = r?.message || 'The order could not be cancelled.';
            }
        } catch (err) {
            this.error = parseApexError(err).message;
        } finally {
            this.cancelling = false;
        }
    }

    // ------------------------------------------------------------------ success screen

    get doneTitle() {
        if (this.cancelled) {
            return 'Order cancelled';
        }
        return this.paid || this.order?.paymentMethod === 'COD' ? 'Order placed' : 'Order received';
    }
    get doneMessage() {
        if (this.cancelled) {
            return `Order ${this.order?.orderNumber} was cancelled.`;
        }
        return this.order?.confirmation || this.order?.statusMessage || 'Thank you! Your order is with the kitchen.';
    }
    get doneBadge() { return statusLabel(this.cancelled ? 'CANCELLED' : this.order?.status); }
    get doneBadgeClass() { return 'badge ' + (this.cancelled ? 'badge-bad' : 'badge-good'); }
    get orderTotalText() { return formatCurrency(this.order?.total, this.order?.currencyCode || this.currencyCode); }
    get orderLines() {
        return (this.order?.items || []).map((i, n) => ({
            key: `${i.menuItemId || i.name}-${n}`,
            text: `${i.quantity} × ${i.name}`,
            totalText: formatCurrency(i.lineTotal, this.order?.currencyCode || this.currencyCode)
        }));
    }
    get hasOrderLines() { return this.orderLines.length > 0; }
    get trackUrl() { return isSafeUrl(this.order?.trackingUrl) ? this.order.trackingUrl : null; }
    get paymentText() {
        if (this.cancelled) {
            return '';
        }
        return this.order?.paymentMethod === 'COD' ? 'Pay at counter / on delivery' : this.paid ? 'Paid online' : '';
    }

    handleOrderMore() {
        this.order = undefined;
        this.paid = false;
        this.cancelled = false;
        this.info = '';
        this.show('menu');
    }
}
