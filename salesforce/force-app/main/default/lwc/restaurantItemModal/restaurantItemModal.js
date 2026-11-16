import { LightningElement, api } from 'lwc';
import { formatCurrency, round2 } from 'c/restaurantUtils';

/**
 * Item detail dialog: photo, price, dietary info, ingredients/allergens (when supplied by the backend),
 * customization choices, free-text instructions and a quantity stepper.
 * Emits `close` and `addtocart` ({ item, quantity, notes }).
 */
export default class RestaurantItemModal extends LightningElement {
    /** A RestaurantMenuItem (the live details call refreshes it). */
    @api item;
    /** Extra fields from RestaurantItemDetails. */
    @api details;
    @api loading = false;
    @api error;

    quantity = 1;
    notes = '';
    selections = {};
    focused = false;

    renderedCallback() {
        if (!this.focused) {
            const close = this.template.querySelector('[data-focus]');
            if (close) {
                close.focus();
                this.focused = true;
            }
        }
    }

    get imageUrl() {
        const url = this.item?.imageUrl;
        return typeof url === 'string' && url.startsWith('https://') ? url : null;
    }
    get unavailable() {
        return this.item?.isAvailable === false;
    }
    get priceText() {
        return formatCurrency(this.item?.price, this.item?.currencyCode);
    }
    get allergenText() {
        return (this.item?.allergens || []).join(', ');
    }
    get nutritionSummary() {
        return this.details?.nutritionSummary;
    }
    get notice() {
        return this.details?.notice || 'Always check with the restaurant if you have an allergy.';
    }
    get allowsNotes() {
        return this.item?.allowsNotes !== false;
    }
    get customizations() {
        return (this.item?.customizations || []).map((g) => ({
            ...g,
            options: (g.options || []).map((o) => ({
                ...o,
                label: o.priceDelta ? `${o.name} (+${formatCurrency(o.priceDelta, this.item?.currencyCode)})` : o.name
            }))
        }));
    }
    get minusDisabled() {
        return this.quantity <= 1;
    }
    get plusDisabled() {
        return this.quantity >= 50;
    }
    get missingRequired() {
        return (this.item?.customizations || []).some((g) => g.isRequired && !this.selections[g.id]);
    }
    get addDisabled() {
        return this.unavailable || this.missingRequired;
    }
    get addLabel() {
        return this.unavailable ? 'Unavailable' : `Add ${this.quantity} · ${formatCurrency(round2((this.item?.price || 0) * this.quantity), this.item?.currencyCode)}`;
    }

    stop(event) {
        event.stopPropagation();
    }
    handleBackdrop() {
        this.handleClose();
    }
    handleKeydown(event) {
        if (event.key === 'Escape') {
            this.handleClose();
        }
    }
    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
    handleMinus() {
        this.quantity = Math.max(1, this.quantity - 1);
    }
    handlePlus() {
        this.quantity = Math.min(50, this.quantity + 1);
    }
    handleNotes(event) {
        this.notes = event.target.value;
    }
    handleOption(event) {
        this.selections = { ...this.selections, [event.target.dataset.group]: event.target.dataset.label };
    }
    handleAdd() {
        if (this.addDisabled) {
            return;
        }
        const chosen = Object.values(this.selections);
        const extra = this.notes.trim();
        // Customization choices travel to the backend as the item's notes (the backend has no structured options yet).
        const notes = [...chosen, extra].filter(Boolean).join('; ');
        this.dispatchEvent(new CustomEvent('addtocart', { detail: { item: this.item, quantity: this.quantity, notes } }));
    }
}
