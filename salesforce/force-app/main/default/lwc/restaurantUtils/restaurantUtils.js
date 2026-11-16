/**
 * Shared helpers for the restaurant components (ordering app + Agentforce renderers).
 * Pure functions only: easy to unit test and safe to reuse anywhere.
 */

/** Formats a number as Indian rupees. Returns '' for missing values so the UI never shows "NaN". */
export function formatCurrency(value, currency = 'INR') {
    if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
        return '';
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2
    }).format(Number(value));
}

/** Rounds to 2 decimals without floating point surprises (money maths in rupees). */
export function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Normalises whatever an imperative Apex call rejects with into { code, message, itemIds }.
 * Our Apex controllers throw AuraHandledException whose message is a small JSON document.
 */
export function parseApexError(error) {
    const fallback = { code: 'UNKNOWN', message: 'Something went wrong. Please try again.', itemIds: [] };
    if (!error) {
        return fallback;
    }
    const raw =
        (error.body && (Array.isArray(error.body) ? error.body[0]?.message : error.body.message)) ||
        error.message ||
        (typeof error === 'string' ? error : null);
    if (!raw) {
        return fallback;
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return {
                code: parsed.code || 'UNKNOWN',
                message: parsed.message || fallback.message,
                itemIds: Array.isArray(parsed.itemIds) ? parsed.itemIds : []
            };
        }
    } catch {
        // not JSON: show it as is
    }
    return { code: 'UNKNOWN', message: String(raw), itemIds: [] };
}

/** Only ever open payment pages over https. */
export function isSafeUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    try {
        return new URL(url).protocol === 'https:';
    } catch {
        return false;
    }
}

/** A unique key for one checkout attempt (prevents duplicate orders on double click or retry). */
export function newIdempotencyKey() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'lwc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

/** Human labels for the order statuses returned by the backend. */
export const STATUS_LABELS = {
    PENDING_PAYMENT: 'Waiting for payment',
    CONFIRMED: 'Order confirmed',
    PREPARING: 'Being prepared',
    READY: 'Ready',
    OUT_FOR_DELIVERY: 'Out for delivery',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    PAYMENT_FAILED: 'Payment failed',
    EXPIRED: 'Payment expired'
};

export function statusLabel(status) {
    return STATUS_LABELS[status] || status || '';
}

/**
 * Builds the progress timeline for an order. Cancelled/failed orders show no progress.
 * @returns {{ terminal: boolean, steps: Array<{key:string,label:string,done:boolean,current:boolean}> }}
 */
export function buildTimeline(status, fulfilment) {
    const delivery = fulfilment === 'DELIVERY';
    const keys = delivery
        ? ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
        : ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
    if (['CANCELLED', 'PAYMENT_FAILED', 'EXPIRED'].includes(status)) {
        return { terminal: true, steps: [] };
    }
    const at = status === 'PENDING_PAYMENT' ? -1 : keys.indexOf(status);
    return {
        terminal: false,
        steps: keys.map((key, i) => ({
            key,
            label: statusLabel(key),
            done: i <= at,
            current: i === at,
            cssClass: 'step' + (i <= at ? ' step-done' : '') + (i === at ? ' step-current' : '')
        }))
    };
}

/** Chip colour class for a status. */
export function statusBadgeClass(status) {
    if (['CANCELLED', 'PAYMENT_FAILED', 'EXPIRED'].includes(status)) {
        return 'badge badge-bad';
    }
    if (['COMPLETED', 'READY', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(status)) {
        return 'badge badge-good';
    }
    return 'badge badge-wait';
}

/** Case-insensitive match of a dish against search text (name, description, tags, category). */
export function matchesSearch(item, text) {
    const needle = (text || '').trim().toLowerCase();
    if (!needle) {
        return true;
    }
    const hay = [item.name, item.description, item.categoryName, ...(item.tags || [])].join(' ').toLowerCase();
    return hay.includes(needle);
}

/** Splits an ISO date-time into something friendly for the customer's locale. */
export function formatDateTime(iso) {
    if (!iso) {
        return '';
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
