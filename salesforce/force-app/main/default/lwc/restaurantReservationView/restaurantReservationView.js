import { LightningElement, api } from 'lwc';
import { formatDateTime } from 'c/restaurantUtils';

/** Agentforce renderer for RestaurantReservationResponse. */
export default class RestaurantReservationView extends LightningElement {
    @api value;

    get failed() {
        return !this.value || this.value.success === false || this.value.cancelled === false;
    }
    get whenText() {
        return formatDateTime(this.value?.startsAt);
    }
    get statusText() {
        const s = this.value?.status;
        return s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
    }
    get badgeClass() {
        if (this.value?.status === 'CANCELLED') {
            return 'badge badge-bad';
        }
        return this.value?.status === 'CONFIRMED' ? 'badge badge-good' : 'badge badge-wait';
    }
}
