import { LightningElement, api } from 'lwc';
import { formatCurrency } from 'c/restaurantUtils';

/** Agentforce renderer for RestaurantItemDetails. */
export default class RestaurantItemView extends LightningElement {
    @api value;

    get failed() {
        return !this.value || this.value.success === false || !this.value.item;
    }
    get item() {
        return this.value?.item || {};
    }
    get imageUrl() {
        const url = this.item.imageUrl;
        return typeof url === 'string' && url.startsWith('https://') ? url : null;
    }
    get priceText() {
        return formatCurrency(this.item.price, this.item.currencyCode);
    }
    get unavailable() {
        return this.item.isAvailable === false;
    }
    get allergenText() {
        return (this.item.allergens || []).join(', ');
    }
}
