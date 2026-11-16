import { LightningElement, api } from 'lwc';
import { formatCurrency, round2 } from 'c/restaurantUtils';

/**
 * Cart panel. Shows live backend prices and an ESTIMATE of tax/delivery from the backend's own configuration.
 * The final amount is always calculated by the restaurant API when the order is placed.
 */
export default class RestaurantCart extends LightningElement {
    /** [{ item, quantity, notes }] */
    @api lines = [];
    /** RestaurantConfigResponse (taxPercent, deliveryFee, ...). May be undefined if it failed to load. */
    @api config;

    get isEmpty() {
        return !this.lines || this.lines.length === 0;
    }
    get currency() {
        return this.lines?.[0]?.item?.currencyCode || this.config?.currencyCode || 'INR';
    }
    get rows() {
        return (this.lines || []).map((l) => ({
            id: l.item.id,
            name: l.item.name,
            quantity: l.quantity,
            notes: l.notes || '',
            allowsNotes: l.item.allowsNotes !== false,
            unavailable: l.item.isAvailable === false,
            unitText: formatCurrency(l.item.price, this.currency),
            totalText: formatCurrency(round2(l.item.price * l.quantity), this.currency),
            atMax: l.quantity >= 50,
            stepperLabel: `Quantity of ${l.item.name}`,
            increaseLabel: `Increase quantity of ${l.item.name}`,
            decreaseLabel: l.quantity === 1 ? `Remove ${l.item.name}` : `Decrease quantity of ${l.item.name}`
        }));
    }
    get subtotal() {
        return round2((this.lines || []).reduce((sum, l) => sum + l.item.price * l.quantity, 0));
    }
    get taxPercent() {
        return Number(this.config?.taxPercent || 0);
    }
    get tax() {
        return round2((this.subtotal * this.taxPercent) / 100);
    }
    get showTax() {
        return this.taxPercent > 0;
    }
    get subtotalText() {
        return formatCurrency(this.subtotal, this.currency);
    }
    get taxText() {
        return formatCurrency(this.tax, this.currency);
    }
    get estimatedTotalText() {
        return formatCurrency(round2(this.subtotal + this.tax), this.currency);
    }
    get chargesNote() {
        const fee = Number(this.config?.deliveryFee || 0);
        const delivery = fee > 0 ? ` Delivery orders add ${formatCurrency(fee, this.currency)}.` : '';
        return `This is an estimate.${delivery} The restaurant calculates the final total when you place the order.`;
    }
    get checkoutDisabled() {
        return this.isEmpty || (this.lines || []).some((l) => l.item.isAvailable === false);
    }

    fire(name, event, extra = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail: { itemId: event.currentTarget.dataset.id, ...extra } }));
    }
    handleIncrease(event) {
        this.fire('increase', event);
    }
    handleDecrease(event) {
        this.fire('decrease', event);
    }
    handleRemove(event) {
        this.fire('remove', event);
    }
    handleNotes(event) {
        this.fire('notes', event, { notes: event.target.value });
    }
    handleCheckout() {
        this.dispatchEvent(new CustomEvent('checkout'));
    }
    handleContinue() {
        this.dispatchEvent(new CustomEvent('continueshopping'));
    }
}
