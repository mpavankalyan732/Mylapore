import { LightningElement, api } from 'lwc';
import createOrder from '@salesforce/apex/RestaurantCartController.createOrder';
import startPayment from '@salesforce/apex/RestaurantCartController.startPayment';
import getPaymentStatus from '@salesforce/apex/RestaurantCartController.getPaymentStatus';
import DISH_PHOTOS from '@salesforce/resourceUrl/restaurantImages';
import cancelOrder from '@salesforce/apex/RestaurantOrderController.cancelOrder';
import getConfig from '@salesforce/apex/RestaurantMenuController.getConfig';
import { formatCurrency, isSafeUrl, matchesSearch, newIdempotencyKey, parseApexError, round2 } from 'c/restaurantUtils';
import { LABELS, format } from './labels';

const MAX_PER_GROUP = 12; // keep the chat compact until the guest narrows the menu down
const MAX_PER_GROUP_FILTERED = 40;
const MAX_QTY = 20;
const PHONE = /^[6-9]\d{9}$/;
const POLL_MS = 4000;

/**
 * Agentforce renderer for the restaurantMenu Lightning Type (Enhanced Chat v2 and Lightning desktop).
 *
 * One component, a simple state machine:  menu -> cart -> details -> payment -> success | failed | expired
 *
 * Rules this component never breaks:
 *  - It sends item ids and quantities only. Prices shown before checkout are estimates; the backend's totals win.
 *  - "Order placed" for an online order appears ONLY when getPaymentStatus returns PAID (the backend sets PAID
 *    after a verified Razorpay webhook). No button, redirect or timer in the browser can produce it.
 *  - Razorpay's checkout.js is never loaded: card opens a server-created Payment Link, UPI shows a server-created QR.
 */
export default class RestaurantMenuView extends LightningElement {
    @api value;

    screen = 'menu';
    cart = {};
    activeCategory = 'all';
    search = '';
    imageStage = {}; // dish id -> how many photo sources already failed
    info = '';
    error = '';

    config;
    customerName = '';
    customerPhone = '';
    fulfilment = 'TAKEAWAY';
    paymentMethod = 'ONLINE';
    addressLine = '';
    pincode = '';
    errors = {};
    submitting = false;
    idempotencyKey = newIdempotencyKey();

    order;
    payMode = null; // null | CARD | UPI_QR
    payInfo = null; // { paymentUrl, qrImageUrl, expiresAt }
    secondsLeft = 0;
    paid = false;
    cancelled = false;
    starting = false;
    checking = false;
    pollTimer;
    tickTimer;

    connectedCallback() {
        this.loadConfig();
    }
    disconnectedCallback() {
        this.stopTimers();
    }

    get label() {
        return LABELS;
    }

    // ------------------------------------------------------------------ screens

    get isMenu() { return this.screen === 'menu'; }
    get isCart() { return this.screen === 'cart'; }
    get isDetails() { return this.screen === 'details'; }
    get isPayment() { return this.screen === 'payment'; }
    get isSuccess() { return this.screen === 'success'; }
    get isFailed() { return this.screen === 'failed'; }
    get isExpired() { return this.screen === 'expired'; }
    get isRetry() { return this.isFailed || this.isExpired; }

    show(screen) {
        this.screen = screen;
        this.error = '';
    }
    goMenu() { this.show('menu'); }
    goCart() { this.show('cart'); }
    goDetails() { this.show('details'); }
    handleBackToCart() { this.show('cart'); }

    // ------------------------------------------------------------------ menu

    get failed() {
        return !this.value || this.value.success === false;
    }
    get hasWarnings() {
        return (this.value?.warnings || []).length > 0;
    }
    get currencyCode() {
        return this.value?.currencyCode || this.config?.currencyCode || 'INR';
    }

    allItems() {
        const v = this.value || {};
        const out = [];
        const seen = new Set();
        const push = (i, categoryName) => {
            if (i && i.id && !seen.has(i.id)) {
                seen.add(i.id);
                out.push({ ...i, categoryName: i.categoryName || categoryName });
            }
        };
        (v.categories || []).forEach((c) => (c.items || []).forEach((i) => push(i, c.name)));
        (v.items || []).forEach((i) => push(i));
        return out;
    }

    get categoryChips() {
        const names = [];
        (this.value?.categories || []).forEach((c) => {
            if ((c.items || []).length > 0 && !names.includes(c.name)) {
                names.push(c.name);
            }
        });
        if (names.length < 2) {
            return [];
        }
        return [this.label.all, ...names].map((name, i) => {
            const key = i === 0 ? 'all' : name;
            const on = this.activeCategory === key;
            return { key, name, selected: on ? 'true' : 'false', cssClass: 'chip' + (on ? ' chip-on' : '') };
        });
    }
    get hasChips() { return this.categoryChips.length > 0; }

    handleChip(event) {
        this.activeCategory = event.currentTarget.dataset.key;
    }
    handleSearch(event) {
        this.search = event.target.value || '';
    }

    toRow(item) {
        const qty = this.cart[item.id]?.quantity || 0;
        const unavailable = item.isAvailable === false;
        const name = item.name || '';
        return {
            id: item.id,
            name,
            description: item.description,
            imageUrl: this.photoFor(item),
            veg: item.isVegetarian !== false,
            bestseller: item.isBestseller === true,
            unavailable,
            canAdd: !unavailable,
            inCart: qty > 0,
            quantity: qty,
            atMax: qty >= MAX_QTY,
            priceText: formatCurrency(item.price, item.currencyCode || this.currencyCode),
            addAria: format(LABELS.addAria, name),
            incAria: format(LABELS.increaseAria, name),
            decAria: format(LABELS.decreaseAria, name)
        };
    }

    get filtering() {
        return this.search.trim().length > 0 || this.activeCategory !== 'all';
    }

    get groups() {
        const v = this.value || {};
        const limit = this.filtering ? MAX_PER_GROUP_FILTERED : MAX_PER_GROUP;
        const make = (key, title, items) => {
            const shown = items.slice(0, limit).map((i) => this.toRow(i));
            const extra = items.length - shown.length;
            return {
                key,
                title,
                items: shown,
                countText: items.length === 1 ? LABELS.dishCountOne : format(LABELS.dishCount, items.length),
                moreText: extra > 0 ? format(LABELS.moreDishes, extra) : null
            };
        };
        const match = (i) => matchesSearch(i, this.search);
        const groups = [];
        (v.categories || []).forEach((c) => {
            if (this.activeCategory !== 'all' && c.name !== this.activeCategory) {
                return;
            }
            const items = (c.items || []).map((i) => ({ ...i, categoryName: i.categoryName || c.name })).filter(match);
            if (items.length > 0) {
                groups.push(make(c.id || c.name, c.name, items));
            }
        });
        if ((v.items || []).length > 0) {
            const flat = v.items.filter(match);
            if (flat.length > 0) {
                groups.push(make('items', '', flat));
            }
        }
        return groups;
    }
    get isEmpty() { return this.groups.length === 0; }

    /**
     * Where to load a dish photo from, in order: 1) the photo bundled in the Salesforce static resource (same origin, so it
     * is never blocked by Content Security Policy), 2) the image link the menu API gave, 3) none (a plate icon is shown).
     */
    photoSources(item) {
        const sources = [];
        if (item.slug && /^[a-z0-9-]+$/i.test(item.slug) && DISH_PHOTOS) {
            sources.push(`${DISH_PHOTOS}/${item.slug}.jpg`);
        }
        if (isSafeUrl(item.imageUrl)) {
            sources.push(item.imageUrl);
        }
        return sources;
    }
    photoFor(item) {
        return this.photoSources(item)[this.imageStage[item.id] || 0] || null;
    }

    handleImageError(event) {
        const id = event.currentTarget.dataset.id;
        if (id) {
            this.imageStage = { ...this.imageStage, [id]: (this.imageStage[id] || 0) + 1 };
        }
    }

    // ------------------------------------------------------------------ cart

    setQuantity(item, quantity) {
        const next = { ...this.cart };
        if (quantity <= 0) {
            delete next[item.id];
        } else {
            next[item.id] = { item, quantity: Math.min(quantity, MAX_QTY), notes: next[item.id]?.notes || '' };
        }
        this.cart = next;
        this.info = '';
    }
    itemById(id) {
        return this.cart[id]?.item || this.allItems().find((i) => i.id === id);
    }
    handleAdd(event) {
        const item = this.itemById(event.currentTarget.dataset.id);
        if (item && item.isAvailable !== false) {
            this.setQuantity(item, (this.cart[item.id]?.quantity || 0) + 1);
        }
    }
    handleDec(event) {
        const item = this.itemById(event.currentTarget.dataset.id);
        if (item) {
            this.setQuantity(item, (this.cart[item.id]?.quantity || 0) - 1);
        }
    }
    handleRemove(event) {
        const item = this.itemById(event.currentTarget.dataset.id);
        if (item) {
            this.setQuantity(item, 0);
        }
    }
    handleNote(event) {
        const id = event.target.dataset.id;
        if (this.cart[id]) {
            this.cart = { ...this.cart, [id]: { ...this.cart[id], notes: (event.target.value || '').slice(0, 200) } };
        }
    }
    handleClearCart() {
        this.cart = {};
        this.show('menu');
    }

    get cartLines() {
        return Object.values(this.cart).map(({ item, quantity, notes }) => ({
            id: item.id,
            name: item.name,
            quantity,
            notes,
            atMax: quantity >= MAX_QTY,
            imageUrl: this.photoFor(item),
            unitText: formatCurrency(item.price, item.currencyCode || this.currencyCode),
            totalText: formatCurrency(round2(Number(item.price || 0) * quantity), item.currencyCode || this.currencyCode),
            incAria: format(LABELS.increaseAria, item.name),
            decAria: format(LABELS.decreaseAria, item.name),
            removeAria: format(LABELS.removeAria, item.name)
        }));
    }
    get cartCount() {
        return Object.values(this.cart).reduce((n, l) => n + l.quantity, 0);
    }
    get hasCart() { return this.cartCount > 0; }
    get cartEmpty() { return this.cartCount === 0; }
    get subtotal() {
        return round2(Object.values(this.cart).reduce((s, l) => s + Number(l.item.price || 0) * l.quantity, 0));
    }
    get subtotalText() { return formatCurrency(this.subtotal, this.currencyCode); }
    get cartBarText() {
        return this.cartCount === 1 ? format(LABELS.cartBarOne, this.subtotalText) : format(LABELS.cartBar, this.cartCount, this.subtotalText);
    }

    // ------------------------------------------------------------------ details

    async loadConfig() {
        try {
            this.config = await getConfig();
        } catch {
            this.config = undefined; // safe defaults below; the backend still validates everything
        }
    }

    get fulfilmentValues() {
        const o = this.config?.fulfilmentOptions;
        return o && o.length ? o : ['TAKEAWAY', 'DINE_IN'];
    }
    get fulfilmentOptions() {
        return this.fulfilmentValues.map((v) => ({ value: v, label: LABELS[v] || v, checked: this.fulfilment === v, cssClass: 'opt' + (this.fulfilment === v ? ' opt-on' : '') }));
    }
    get paymentOptions() {
        const values = ['ONLINE'];
        if ((this.config?.paymentMethods || []).includes('COD')) {
            values.push('COD');
        }
        const labels = { ONLINE: LABELS.payOnline, COD: LABELS.payCounter };
        return values.map((v) => ({ value: v, label: labels[v], checked: this.paymentMethod === v, cssClass: 'opt' + (this.paymentMethod === v ? ' opt-on' : '') }));
    }
    get showPaymentChoice() { return this.paymentOptions.length > 1; }
    get isDelivery() { return this.fulfilment === 'DELIVERY'; }
    get nameClass() { return this.errors.customerName ? 'bad' : ''; }
    get phoneClass() { return this.errors.customerPhone ? 'bad' : ''; }
    get addressClass() { return this.errors.addressLine ? 'bad' : ''; }
    get pincodeClass() { return this.errors.pincode ? 'bad' : ''; }
    get nameInvalid() { return this.errors.customerName ? 'true' : 'false'; }
    get phoneInvalid() { return this.errors.customerPhone ? 'true' : 'false'; }
    get addressInvalid() { return this.errors.addressLine ? 'true' : 'false'; }
    get pincodeInvalid() { return this.errors.pincode ? 'true' : 'false'; }
    get reviewLabel() { return this.submitting ? LABELS.reviewing : LABELS.reviewOrder; }

    handleField(event) {
        const { name, value } = event.target;
        if (name === 'pincode') {
            this.pincode = (value || '').replace(/\D/g, '').slice(0, 6);
        } else if (name === 'customerPhone') {
            this.customerPhone = (value || '').replace(/[^\d+\s-]/g, '').slice(0, 16);
        } else {
            this[name] = value;
        }
    }

    handleReviewKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleReview(event);
        }
    }

    cleanPhone() {
        return this.customerPhone.replace(/[\s-]/g, '').replace(/^\+?91(?=\d{10}$)/, '');
    }

    validate() {
        const e = {};
        if (this.customerName.trim().length < 2) {
            e.customerName = LABELS.errName;
        }
        if (!PHONE.test(this.cleanPhone())) {
            e.customerPhone = LABELS.errPhone;
        }
        if (this.isDelivery) {
            if (this.addressLine.trim().length < 4) {
                e.addressLine = LABELS.errAddress;
            }
            if (!/^\d{6}$/.test(this.pincode)) {
                e.pincode = LABELS.errPincode;
            } else if (Array.isArray(this.config?.servicePincodes) && this.config.servicePincodes.length && !this.config.servicePincodes.includes(this.pincode)) {
                e.pincode = LABELS.errPincodeArea;
            }
        }
        return e;
    }

    async handleReview(event) {
        event?.preventDefault?.();
        if (this.submitting) {
            return; // duplicate-click guard
        }
        this.errors = this.validate();
        if (Object.keys(this.errors).length > 0) {
            this.error = LABELS.fixFields;
            return;
        }
        this.error = '';
        this.submitting = true;
        const orderRequest = {
            customerName: this.customerName.trim(),
            customerPhone: this.cleanPhone(),
            fulfilment: this.fulfilment,
            paymentMethod: this.paymentMethod,
            deliveryAddressLine: this.isDelivery ? this.addressLine.trim() : null,
            deliveryPincode: this.isDelivery ? this.pincode : null,
            idempotencyKey: this.idempotencyKey,
            // Item ids and quantities only: the restaurant API calculates every price.
            items: Object.values(this.cart).map((l) => ({ menuItemId: l.item.id, quantity: l.quantity, notes: l.notes || null }))
        };
        try {
            const order = await createOrder({ orderRequestJson: JSON.stringify(orderRequest) });
            this.idempotencyKey = newIdempotencyKey();
            this.order = order;
            this.cart = {};
            if (order.paymentMethod === 'COD' && order.status === 'CONFIRMED') {
                this.paid = false;
                this.show('success'); // confirmed by the backend; payment happens at the counter
            } else {
                this.payMode = null;
                this.payInfo = null;
                this.show('payment');
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
        this.info = LABELS.dishesRemoved;
        this.show(this.hasCart ? 'cart' : 'menu');
    }

    // ------------------------------------------------------------------ payment

    get orderTitle() { return format(LABELS.orderNumber, this.order?.orderNumber || ''); }
    get currencyOfOrder() { return this.order?.currencyCode || this.currencyCode; }
    get orderTotalText() { return formatCurrency(this.order?.total, this.currencyOfOrder); }
    get orderSubtotalText() { return formatCurrency(this.order?.subtotal, this.currencyOfOrder); }
    get orderTaxText() { return formatCurrency(this.order?.tax, this.currencyOfOrder); }
    get orderFeeText() { return formatCurrency(this.order?.deliveryFee, this.currencyOfOrder); }
    get showOrderTax() { return Number(this.order?.tax) > 0; }
    get showOrderFee() { return Number(this.order?.deliveryFee) > 0; }
    get orderLines() {
        return (this.order?.items || []).map((i, n) => ({
            key: `${i.menuItemId || i.name}-${n}`,
            text: `${i.quantity} × ${i.name}`,
            totalText: formatCurrency(i.lineTotal, this.currencyOfOrder)
        }));
    }
    get hasOrderLines() { return this.orderLines.length > 0; }

    get chooseMethod() { return this.isPayment && !this.payMode; }
    get isCardWait() { return this.isPayment && this.payMode === 'CARD'; }
    get isQrWait() { return this.isPayment && this.payMode === 'UPI_QR'; }
    get paymentUrl() { return isSafeUrl(this.payInfo?.paymentUrl) ? this.payInfo.paymentUrl : null; }
    get qrImageUrl() { return isSafeUrl(this.payInfo?.qrImageUrl) ? this.payInfo.qrImageUrl : null; }
    get qrAlt() { return format(LABELS.qrAlt, this.orderTotalText); }
    get scanAmountText() { return format(LABELS.scanAmount, this.orderTotalText); }
    get countdownText() {
        const s = Math.max(0, this.secondsLeft);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return format(LABELS.expiresIn, `${mm}:${ss}`);
    }

    openPaymentWindow() {
        const paymentWindow = window.open('about:blank', '_blank');
        if (paymentWindow) {
            // Keep the new tab isolated from the restaurant page while retaining its navigation handle.
            paymentWindow.opener = null;
        }
        return paymentWindow;
    }

    handlePayCard() { this.begin('CARD', this.openPaymentWindow()); }
    handlePayUpi() { this.begin('UPI_QR'); }
    handleTryAgain() {
        const method = this.payMode || 'UPI_QR';
        const paymentWindow = method === 'CARD' ? this.openPaymentWindow() : null;
        this.show('payment');
        this.begin(method, paymentWindow);
    }
    handleChangeMethod() {
        this.stopTimers();
        this.payMode = null;
        this.payInfo = null;
        this.error = '';
    }

    async begin(method, paymentWindow = null) {
        if (this.starting || !this.order?.orderNumber) {
            return;
        }
        this.starting = true;
        this.error = '';
        this.stopTimers();
        try {
            const s = await startPayment({ orderNumber: this.order.orderNumber, customerPhone: this.cleanPhone(), method });
            this.payMode = method;
            this.payInfo = { paymentUrl: s.paymentUrl, qrImageUrl: s.qrImageUrl, expiresAt: s.expiresAt };
            this.show('payment');
            if (method === 'CARD' && isSafeUrl(s.paymentUrl)) {
                if (paymentWindow && !paymentWindow.closed) {
                    paymentWindow.location.replace(s.paymentUrl);
                }
            } else if (paymentWindow && !paymentWindow.closed) {
                paymentWindow.close();
            }
            this.startTimers();
        } catch (err) {
            if (paymentWindow && !paymentWindow.closed) {
                paymentWindow.close();
            }
            this.error = parseApexError(err).message;
        } finally {
            this.starting = false;
        }
    }

    startTimers() {
        this.stopTimers();
        this.updateCountdown();
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.pollTimer = setInterval(() => this.checkPayment(), POLL_MS);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.tickTimer = setInterval(() => this.tick(), 1000);
    }
    stopTimers() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = undefined;
        }
    }
    updateCountdown() {
        const t = this.payInfo?.expiresAt ? new Date(this.payInfo.expiresAt).getTime() : NaN;
        this.secondsLeft = Number.isNaN(t) ? 0 : Math.max(0, Math.ceil((t - Date.now()) / 1000));
    }
    tick() {
        this.updateCountdown();
        if (this.secondsLeft <= 0 && this.isPayment) {
            this.checkPayment(); // one last look: the backend decides between PAID and EXPIRED
        }
    }

    /** The ONLY way to reach the success screen for an online order is status === 'PAID' from the backend. */
    async checkPayment() {
        if (this.checking || !this.order?.orderNumber || !this.isPayment || !this.payMode) {
            return;
        }
        this.checking = true;
        try {
            const s = await getPaymentStatus({ orderNumber: this.order.orderNumber, customerPhone: this.cleanPhone() });
            if (!this.isPayment) {
                return; // the card moved on while we waited
            }
            if (s.status === 'PAID') {
                this.stopTimers();
                this.order = { ...this.order, status: s.orderStatus || 'CONFIRMED', paymentStatus: 'PAID' };
                this.paid = true;
                this.show('success');
            } else if (s.status === 'FAILED') {
                this.stopTimers();
                this.show('failed');
            } else if (s.status === 'EXPIRED' || (this.secondsLeft <= 0 && this.payInfo?.expiresAt)) {
                this.stopTimers();
                this.show('expired');
            }
        } catch {
            // transient network or cold-start problems: keep polling until the QR / link expires
        } finally {
            this.checking = false;
        }
    }

    async handleCancelOrder() {
        if (this.cancelling || !this.order?.orderNumber) {
            return;
        }
        this.cancelling = true;
        this.error = '';
        try {
            const r = await cancelOrder({
                orderNumber: this.order.orderNumber,
                customerPhone: this.cleanPhone(),
                reason: 'Cancelled by customer from the menu card',
                confirmed: true
            });
            if (r && r.cancelled === true) {
                this.stopTimers();
                this.cancelled = true;
                this.paid = false;
                this.show('success');
            } else {
                this.error = r?.message || LABELS.genericError;
            }
        } catch (err) {
            this.error = parseApexError(err).message;
        } finally {
            this.cancelling = false;
        }
    }
    cancelling = false;

    // ------------------------------------------------------------------ result screens

    get showPaidSuccess() { return this.isSuccess && this.paid && !this.cancelled; }
    get showCounterSuccess() { return this.isSuccess && !this.paid && !this.cancelled; }
    get showCancelled() { return this.isSuccess && this.cancelled; }
    get cancelledBody() { return format(LABELS.cancelledBody, this.order?.orderNumber || ''); }
    get totalLabel() { return this.paid ? LABELS.totalPaid : LABELS.totalDue; }
    get trackUrl() { return isSafeUrl(this.order?.trackingUrl) ? this.order.trackingUrl : null; }
    get retryTitle() { return this.isFailed ? LABELS.failedTitle : LABELS.expiredTitle; }
    get retryBody() { return this.isFailed ? LABELS.failedBody : LABELS.expiredBody; }

    handleOrderMore() {
        this.stopTimers();
        this.order = undefined;
        this.payMode = null;
        this.payInfo = null;
        this.paid = false;
        this.cancelled = false;
        this.show('menu');
    }
}
