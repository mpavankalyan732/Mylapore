import { LightningElement, api } from 'lwc';
import { buildTimeline, formatCurrency, isSafeUrl, statusBadgeClass, statusLabel } from 'c/restaurantUtils';

/** Agentforce renderer for RestaurantOrderStatusResponse. */
export default class RestaurantOrderStatusView extends LightningElement {
    @api value;

    get failed() {
        return !this.value || this.value.success === false;
    }
    get statusText() {
        return statusLabel(this.value?.status);
    }
    get badgeClass() {
        return statusBadgeClass(this.value?.status);
    }
    get totalText() {
        return formatCurrency(this.value?.total, this.value?.currencyCode);
    }
    get timeline() {
        return buildTimeline(this.value?.status, this.value?.fulfilment);
    }
    get hasTimeline() {
        return !this.timeline.terminal;
    }
    get steps() {
        return this.timeline.steps;
    }
    get payUrl() {
        return isSafeUrl(this.value?.checkoutUrl) ? this.value.checkoutUrl : null;
    }
}
