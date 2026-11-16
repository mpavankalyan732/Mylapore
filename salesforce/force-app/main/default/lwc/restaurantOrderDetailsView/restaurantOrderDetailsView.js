import { LightningElement, api } from 'lwc';
import { buildTimeline, formatCurrency, formatDateTime, isSafeUrl, statusBadgeClass, statusLabel } from 'c/restaurantUtils';

/** Agentforce renderer for RestaurantOrderDetails (also reused by the ordering app's order lookup). */
export default class RestaurantOrderDetailsView extends LightningElement {
    @api value;

    get failed() {
        return !this.value || this.value.success === false;
    }
    get placedAt() {
        return formatDateTime(this.value?.createdAt);
    }

    get lines() {
        return (this.value?.items || []).map((i, n) => ({
            key: `${i.menuItemId || 'i'}-${n}`,
            text: `${i.quantity} × ${i.name}`,
            notes: i.notes,
            totalText: formatCurrency(i.lineTotal, this.value.currencyCode)
        }));
    }
    get subtotalText() { return formatCurrency(this.value?.subtotal, this.value?.currencyCode); }
    get taxText() { return formatCurrency(this.value?.tax, this.value?.currencyCode); }
    get deliveryFeeText() { return formatCurrency(this.value?.deliveryFee, this.value?.currencyCode); }
    get totalText() { return formatCurrency(this.value?.total, this.value?.currencyCode); }
    get showTax() { return Number(this.value?.tax) > 0; }
    get showDeliveryFee() { return Number(this.value?.deliveryFee) > 0; }
    get statusText() { return statusLabel(this.value?.status); }
    get badgeClass() { return statusBadgeClass(this.value?.status); }
    get timeline() { return buildTimeline(this.value?.status, this.value?.fulfilment); }
    get hasTimeline() { return !this.timeline.terminal; }
    get steps() { return this.timeline.steps; }
    get payUrl() { return isSafeUrl(this.value?.checkoutUrl) ? this.value.checkoutUrl : null; }
}
