import { LightningElement, api } from 'lwc';
import getOrderDetails from '@salesforce/apex/RestaurantOrderController.getOrderDetails';
import cancelOrder from '@salesforce/apex/RestaurantOrderController.cancelOrder';
import { parseApexError } from 'c/restaurantUtils';

/**
 * Track an order and cancel it when the restaurant's rules allow. The customer proves ownership with the
 * phone number used for the order. A cancellation is only reported after the backend confirms it.
 */
export default class RestaurantOrderLookup extends LightningElement {
    /** Optional prefill (used right after placing an order). */
    @api orderNumber = '';
    @api phone = '';
    @api autoLookup = false;

    details;
    loading = false;
    cancelling = false;
    confirming = false;
    error = '';
    notice = '';
    noticeTone = 'info';
    focused = false;
    didAuto = false;

    connectedCallback() {
        if (this.autoLookup && this.orderNumber && this.phone && !this.didAuto) {
            this.didAuto = true;
            this.lookup();
        }
    }

    renderedCallback() {
        if (this.confirming && !this.focused) {
            const btn = this.template.querySelector('[data-focus]');
            if (btn) {
                btn.focus();
                this.focused = true;
            }
        }
    }

    get lookupLabel() {
        return this.loading ? 'Looking…' : 'Find order';
    }
    get cancelLabel() {
        return this.cancelling ? 'Cancelling…' : 'Yes, cancel it';
    }
    get noticeClass() {
        return 'alert ' + (this.noticeTone === 'ok' ? 'alert-ok' : 'alert-info');
    }
    get confirmText() {
        return this.details?.paymentMethod === 'ONLINE' && this.details?.paymentStatus === 'PAID'
            ? 'You already paid online. The restaurant team will refund your payment after the cancellation.'
            : 'This cannot be undone.';
    }

    handleField(event) {
        this[event.target.name === 'phone' ? 'phone' : 'orderNumber'] = event.target.value;
    }
    handleEnterKey(event) {
        if (event.key === 'Enter') {
            event.preventDefault?.();
            event.target?.blur?.();
            this.handleLookup(event);
        }
    }
    handleBack() {
        this.dispatchEvent(new CustomEvent('back'));
    }
    stop(event) {
        event.stopPropagation();
    }
    handleKeydown(event) {
        if (event.key === 'Escape') {
            this.handleDismiss();
        }
    }
    handleDismiss() {
        this.confirming = false;
        this.focused = false;
    }
    handleAskCancel() {
        this.confirming = true;
    }

    handleLookup(event) {
        event?.preventDefault?.();
        this.lookup();
    }

    async lookup(keepNotice = false) {
        if (this.loading) {
            return;
        }
        this.error = '';
        if (!keepNotice) {
            this.notice = '';
        }
        if (!this.orderNumber.trim() || !this.phone.trim()) {
            this.error = 'Enter your order number and the mobile number used for the order.';
            return;
        }
        this.loading = true;
        try {
            this.details = await getOrderDetails({ orderNumber: this.orderNumber.trim(), customerPhone: this.phone.trim() });
        } catch (err) {
            this.details = undefined;
            const parsed = parseApexError(err);
            this.error = parsed.code === 'NOT_FOUND' ? 'No order was found for that order number and phone number.' : parsed.message;
        } finally {
            this.loading = false;
        }
    }

    async handleConfirmCancel() {
        if (this.cancelling) {
            return;
        }
        this.cancelling = true;
        this.error = '';
        try {
            const result = await cancelOrder({
                orderNumber: this.details.orderNumber,
                customerPhone: this.phone.trim(),
                reason: 'Cancelled by customer in the ordering component',
                confirmed: true
            });
            this.confirming = false;
            this.focused = false;
            // Report exactly what the backend said, never more.
            this.notice = result.cancelled ? `Order cancelled. ${result.message || ''}`.trim() : result.message || 'The order could not be cancelled.';
            this.noticeTone = result.cancelled ? 'ok' : 'info';
            await this.lookup(true); // refresh the real status, keeping the message about the cancellation
        } catch (err) {
            this.confirming = false;
            this.focused = false;
            this.error = parseApexError(err).message;
        } finally {
            this.cancelling = false;
        }
    }
}
