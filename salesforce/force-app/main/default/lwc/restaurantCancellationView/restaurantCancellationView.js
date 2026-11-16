import { LightningElement, api } from 'lwc';
import { statusLabel } from 'c/restaurantUtils';

/** Agentforce renderer for RestaurantCancellationResponse. Shows success only when the backend confirmed it. */
export default class RestaurantCancellationView extends LightningElement {
    @api value;

    get cancelled() {
        return this.value?.success === true && this.value?.cancelled === true;
    }
    get statusText() {
        return statusLabel(this.value?.status);
    }
}
