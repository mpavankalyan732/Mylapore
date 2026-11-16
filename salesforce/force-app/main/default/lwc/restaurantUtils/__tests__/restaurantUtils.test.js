import {
    buildTimeline,
    formatCurrency,
    isSafeUrl,
    matchesSearch,
    newIdempotencyKey,
    parseApexError,
    round2,
    statusBadgeClass,
    statusLabel
} from 'c/restaurantUtils';

describe('restaurantUtils', () => {
    test('formatCurrency formats rupees and never shows NaN', () => {
        expect(formatCurrency(90)).toContain('90');
        expect(formatCurrency(90)).toMatch(/₹|INR/);
        expect(formatCurrency(1234.5)).toContain('1,234.5');
        expect(formatCurrency(null)).toBe('');
        expect(formatCurrency(undefined)).toBe('');
        expect(formatCurrency('abc')).toBe('');
    });

    test('round2 avoids floating point drift', () => {
        expect(round2(0.1 + 0.2)).toBe(0.3);
        expect(round2(180 * 1.05)).toBe(189);
    });

    test('parseApexError understands our structured AuraHandledException messages', () => {
        const err = { body: { message: JSON.stringify({ code: 'ITEM_UNAVAILABLE', message: 'Gone', itemIds: ['a', 'b'] }) } };
        expect(parseApexError(err)).toEqual({ code: 'ITEM_UNAVAILABLE', message: 'Gone', itemIds: ['a', 'b'] });
    });

    test('parseApexError falls back for plain text, arrays and empty input', () => {
        expect(parseApexError({ body: { message: 'Plain text' } })).toEqual({ code: 'UNKNOWN', message: 'Plain text', itemIds: [] });
        expect(parseApexError({ body: [{ message: JSON.stringify({ code: 'X', message: 'Y' }) }] }).code).toBe('X');
        expect(parseApexError({ message: 'boom' }).message).toBe('boom');
        expect(parseApexError(undefined).message).toMatch(/went wrong/i);
        expect(parseApexError({}).code).toBe('UNKNOWN');
    });

    test('isSafeUrl only accepts https', () => {
        expect(isSafeUrl('https://pay.example.com/x')).toBe(true);
        expect(isSafeUrl('http://pay.example.com/x')).toBe(false);
        expect(isSafeUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeUrl('')).toBe(false);
        expect(isSafeUrl(null)).toBe(false);
    });

    test('idempotency keys are unique', () => {
        expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
    });

    test('status labels and badges', () => {
        expect(statusLabel('PREPARING')).toBe('Being prepared');
        expect(statusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
        expect(statusBadgeClass('CANCELLED')).toContain('badge-bad');
        expect(statusBadgeClass('CONFIRMED')).toContain('badge-good');
        expect(statusBadgeClass('PENDING_PAYMENT')).toContain('badge-wait');
    });

    test('buildTimeline marks progress and adds delivery step only for delivery', () => {
        const t = buildTimeline('PREPARING', 'TAKEAWAY');
        expect(t.terminal).toBe(false);
        expect(t.steps.map((s) => s.key)).toEqual(['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']);
        expect(t.steps.filter((s) => s.done).map((s) => s.key)).toEqual(['CONFIRMED', 'PREPARING']);
        expect(t.steps.find((s) => s.current).key).toBe('PREPARING');
        expect(buildTimeline('PREPARING', 'DELIVERY').steps).toHaveLength(5);
        expect(buildTimeline('PENDING_PAYMENT', 'TAKEAWAY').steps.some((s) => s.done)).toBe(false);
        expect(buildTimeline('CANCELLED', 'TAKEAWAY')).toEqual({ terminal: true, steps: [] });
    });

    test('matchesSearch checks name, description, tags and category', () => {
        const item = { name: 'Masala Dosa', description: 'Crisp crepe', categoryName: 'Idli & Dosa', tags: ['goes-with-rice'] };
        expect(matchesSearch(item, '')).toBe(true);
        expect(matchesSearch(item, 'masala')).toBe(true);
        expect(matchesSearch(item, 'CREPE')).toBe(true);
        expect(matchesSearch(item, 'idli')).toBe(true);
        expect(matchesSearch(item, 'rice')).toBe(true);
        expect(matchesSearch(item, 'pizza')).toBe(false);
    });
});
