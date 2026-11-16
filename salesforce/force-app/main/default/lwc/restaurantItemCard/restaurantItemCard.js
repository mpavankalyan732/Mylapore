import { LightningElement, api } from 'lwc';
import { formatCurrency } from 'c/restaurantUtils';

const MAX_QTY = 50; // the backend accepts 1-50 per line

/** One dish in the menu grid. Emits view/add/increase/decrease; the container owns the cart. */
export default class RestaurantItemCard extends LightningElement {
    @api item;
    @api quantity = 0;

    get imageUrl() {
        const url = this.item?.imageUrl;
        return typeof url === 'string' && url.startsWith('https://') ? url : null;
    }
    get priceText() {
        return formatCurrency(this.item?.price, this.item?.currencyCode);
    }
    get unavailable() {
        return this.item?.isAvailable === false;
    }
    get inCart() {
        return Number(this.quantity) > 0;
    }
    get atMax() {
        return Number(this.quantity) >= MAX_QTY;
    }
    get hasCustomization() {
        return (this.item?.customizations || []).length > 0;
    }
    get cardClass() {
        return 'card dish' + (this.unavailable ? ' dish-off' : '');
    }
    get viewLabel() {
        return `View details of ${this.item?.name}`;
    }
    get addLabel() {
        return `Add ${this.item?.name} to cart`;
    }
    get increaseLabel() {
        return `Increase quantity of ${this.item?.name}`;
    }
    get decreaseLabel() {
        return Number(this.quantity) === 1 ? `Remove ${this.item?.name} from cart` : `Decrease quantity of ${this.item?.name}`;
    }
    get stepperLabel() {
        return `Quantity of ${this.item?.name}`;
    }

    emit(name) {
        this.dispatchEvent(new CustomEvent(name, { detail: { itemId: this.item.id } }));
    }
    handleView() {
        this.emit('view');
    }
    handleAdd() {
        this.emit('add');
    }
    handleIncrease() {
        this.emit('increase');
    }
    handleDecrease() {
        this.emit('decrease');
    }
}
