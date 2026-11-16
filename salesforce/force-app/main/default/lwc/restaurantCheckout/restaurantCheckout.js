import { LightningElement, api } from 'lwc';
import placeOrder from '@salesforce/apex/RestaurantOrderController.placeOrder';
import { formatCurrency, newIdempotencyKey, parseApexError, round2 } from 'c/restaurantUtils';

const FULFILMENT_LABELS = { TAKEAWAY: 'Takeaway', DINE_IN: 'Dine-in', DELIVERY: 'Home delivery' };
const PAYMENT_LABELS = { ONLINE: 'Pay online (UPI / cards / netbanking)', COD: 'Pay at counter / on delivery' };
const PHONE = /^(\+?91)?[6-9]\d{9}$/;

/**
 * Checkout form. Collects only what the backend needs, validates it, and submits through Apex.
 * Duplicate submissions are prevented twice: the button is disabled while sending and every attempt
 * carries an idempotency key that the backend honours.
 * Emits `back`, `placed` ({ order, phone }) and `unavailable` ({ itemIds }).
 */
export default class RestaurantCheckout extends LightningElement {
    @api lines = [];
    @api config;

    customerName = '';
    customerPhone = '';
    customerEmail = '';
    fulfilment = 'TAKEAWAY';
    paymentMethod = '';
    addressLine = '';
    pincode = '';
    landmark = '';
    notes = '';
    submitting = false;
    error = '';
    errors = {};
    idempotencyKey = newIdempotencyKey();

    // ------------------------------------------------------------------ options (from the backend's own configuration)

    get fulfilmentValues() {
        const opts = this.config?.fulfilmentOptions;
        return opts && opts.length ? opts : ['TAKEAWAY', 'DINE_IN'];
    }
    get paymentValues() {
        const opts = this.config?.paymentMethods;
        return opts && opts.length ? opts : ['ONLINE'];
    }
    get fulfilmentOptions() {
        return this.fulfilmentValues.map((v) => this.option(v, FULFILMENT_LABELS, this.fulfilment === v));
    }
    get paymentOptions() {
        const selected = this.selectedPayment;
        return this.paymentValues.map((v) => this.option(v, PAYMENT_LABELS, selected === v));
    }
    get selectedPayment() {
        return this.paymentValues.includes(this.paymentMethod) ? this.paymentMethod : this.paymentValues[0];
    }
    option(value, labels, checked) {
        return { value, label: labels[value] || value, checked, cssClass: 'opt' + (checked ? ' opt-on' : '') };
    }

    get isDelivery() {
        return this.fulfilment === 'DELIVERY';
    }
    get isOnline() {
        return this.selectedPayment === 'ONLINE';
    }
    get pincodeKnown() {
        return this.pincode.length === 6 && Array.isArray(this.config?.servicePincodes);
    }
    get pincodeOk() {
        return this.pincodeKnown && this.config.servicePincodes.includes(this.pincode);
    }
    get pincodeBad() {
        return this.pincodeKnown && !this.config.servicePincodes.includes(this.pincode);
    }

    // ------------------------------------------------------------------ money (estimate only)

    get currency() {
        return this.lines?.[0]?.item?.currencyCode || this.config?.currencyCode || 'INR';
    }
    get subtotal() {
        return round2((this.lines || []).reduce((s, l) => s + l.item.price * l.quantity, 0));
    }
    get tax() {
        return round2((this.subtotal * Number(this.config?.taxPercent || 0)) / 100);
    }
    get deliveryFee() {
        return this.isDelivery ? Number(this.config?.deliveryFee || 0) : 0;
    }
    get subtotalText() {
        return formatCurrency(this.subtotal, this.currency);
    }
    get taxText() {
        return formatCurrency(this.tax, this.currency);
    }
    get deliveryFeeText() {
        return formatCurrency(this.deliveryFee, this.currency);
    }
    get estimatedTotalText() {
        return formatCurrency(round2(this.subtotal + this.tax + this.deliveryFee), this.currency);
    }
    get showTax() {
        return this.tax > 0;
    }
    get showDeliveryFee() {
        return this.deliveryFee > 0;
    }
    get submitLabel() {
        return this.submitting ? 'Placing your order…' : `Place order · ${this.estimatedTotalText}`;
    }

    // ------------------------------------------------------------------ field state

    get nameInvalid() {
        return !!this.errors.customerName;
    }
    get phoneInvalid() {
        return !!this.errors.customerPhone;
    }
    get nameClass() {
        return this.errors.customerName ? 'bad' : '';
    }
    get phoneClass() {
        return this.errors.customerPhone ? 'bad' : '';
    }
    get addressClass() {
        return this.errors.addressLine ? 'bad' : '';
    }
    get pincodeClass() {
        return this.errors.pincode ? 'bad' : '';
    }

    handleField(event) {
        const { name, value } = event.target;
        if (name === 'pincode') {
            this.pincode = value.replace(/\D/g, '').slice(0, 6);
        } else if (name === 'paymentMethod') {
            this.paymentMethod = value;
        } else if (name === 'landmark') {
            this.landmark = value;
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
            } else if (this.pincodeBad) {
                e.pincode = 'We do not deliver to this pincode yet';
            }
        }
        return e;
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('back'));
    }

    async handleSubmit(event) {
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
            customerEmail: this.customerEmail.trim() || null,
            fulfilment: this.fulfilment,
            paymentMethod: this.selectedPayment,
            deliveryAddressLine: this.isDelivery ? this.addressLine.trim() : null,
            deliveryPincode: this.isDelivery ? this.pincode : null,
            deliveryLandmark: this.isDelivery ? this.landmark.trim() || null : null,
            notes: this.notes.trim() || null,
            idempotencyKey: this.idempotencyKey,
            // No prices are sent: the restaurant API calculates them.
            items: this.lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity, notes: l.notes || null }))
        };
        try {
            const order = await placeOrder({ orderRequest });
            this.idempotencyKey = newIdempotencyKey();
            this.dispatchEvent(new CustomEvent('placed', { detail: { order, phone: orderRequest.customerPhone } }));
        } catch (err) {
            const parsed = parseApexError(err);
            this.error = parsed.message;
            if (parsed.code === 'ITEM_UNAVAILABLE') {
                this.dispatchEvent(new CustomEvent('unavailable', { detail: { itemIds: parsed.itemIds } }));
            }
            // After a lost connection the order may have been created: keep the key so a retry returns it, not a duplicate.
            if (parsed.code !== 'UNREACHABLE') {
                this.idempotencyKey = newIdempotencyKey();
            }
        } finally {
            this.submitting = false;
        }
    }
}
