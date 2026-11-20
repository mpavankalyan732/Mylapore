/**
 * The only Apex the menu card calls to order and pay. Written for the Enhanced Chat site guest user:
 * every input is validated again here, prices are never accepted (the backend calculates them), and a guest can
 * only ever reach an order by giving the phone number it was placed with.
 * Payment is confirmed by the backend's signed Razorpay webhook. Nothing in this class can mark an order PAID by itself:
 * getPaymentStatus only copies what the backend reports.
 */
public with sharing class RestaurantCartController {
    private static final Integer MAX_LINES = 50;
    @TestVisible private static Boolean guestContextOverride;

    private static Boolean isGuestContext() {
        return guestContextOverride == null ? UserInfo.getUserType() == 'Guest' : guestContextOverride;
    }

    /** @param orderRequestJson JSON of RestaurantOrderRequest: customer, fulfilment, address and items (menuItemId, quantity, notes). */
    @AuraEnabled
    public static RestaurantOrderResponse createOrder(String orderRequestJson) {
        RestaurantOrderRequest req = parse(orderRequestJson);
        // Defence in depth: ignore anything the browser could have tampered with.
        req.deferCheckout = true;
        req.paymentMethod = RestaurantApiService.normaliseEnum(req.paymentMethod) == 'COD' ? 'COD' : 'ONLINE';
        if (req.items != null) {
            if (req.items.size() > MAX_LINES) {
                throw RestaurantAuraSupport.plain('Too many different dishes in one order.');
            }
            for (RestaurantOrderItem i : req.items) {
                if (i != null) {
                    i.name = null;
                    i.unitPrice = null;
                    i.lineTotal = null;
                }
            }
        }
        try {
            RestaurantOrderResponse res = isGuestContext() ? RestaurantPublicApiService.createOrder(req) : RestaurantApiService.createOrder(req);
            RestaurantOrderSync.save(req, res); // DML only after the callout
            return res;
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    /** @param method CARD (Razorpay payment link) or UPI_QR (single-use QR). */
    @AuraEnabled
    public static RestaurantPaymentStart startPayment(String orderNumber, String customerPhone, String method) {
        try {
            RestaurantPaymentStart s = isGuestContext()
                ? RestaurantPublicApiService.startPayment(orderNumber, customerPhone, method)
                : RestaurantApiService.startPayment(orderNumber, customerPhone, method);
            if (String.isNotBlank(s.paymentUrl) && !s.paymentUrl.startsWith('https://')) {
                throw RestaurantAuraSupport.plain('The payment page address was not secure, so it was not opened.');
            }
            if (String.isNotBlank(s.qrImageUrl) && !s.qrImageUrl.startsWith('https://')) {
                throw RestaurantAuraSupport.plain('The QR image address was not secure, so it was not shown.');
            }
            RestaurantOrderSync.markPaymentStarted(s);
            return s;
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @AuraEnabled
    public static RestaurantPaymentStatus getPaymentStatus(String orderNumber, String customerPhone) {
        try {
            RestaurantPaymentStatus s = isGuestContext()
                ? RestaurantPublicApiService.getPaymentStatus(orderNumber, customerPhone)
                : RestaurantApiService.getPaymentStatus(orderNumber, customerPhone);
            RestaurantOrderSync.updatePayment(s);
            return s;
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @TestVisible
    private static RestaurantOrderRequest parse(String raw) {
        if (String.isBlank(raw) || raw.length() > 20000) {
            throw RestaurantAuraSupport.plain('The order could not be read. Please try again.');
        }
        try {
            RestaurantOrderRequest req = (RestaurantOrderRequest) JSON.deserialize(raw, RestaurantOrderRequest.class);
            if (req == null) {
                throw RestaurantAuraSupport.plain('The order could not be read. Please try again.');
            }
            return req;
        } catch (JSONException e) {
            throw RestaurantAuraSupport.plain('The order could not be read. Please try again.');
        }
    }
}
