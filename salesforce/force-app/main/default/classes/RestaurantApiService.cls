/**
 * The ONLY class that talks to the restaurant API (NestJS, /api/v1/agent/*).
 *
 * - Endpoint and authentication live in the Named Credential "Restaurant_API" (+ External Credential).
 *   No URL, token or key is hard-coded here, and nothing secret is ever logged.
 * - The API owns all business rules (pricing, availability, cancellation). This class only transports data.
 * - Throws RestaurantApiException for anything that is not a 2xx answer.
 */
public with sharing class RestaurantApiService {
    @TestVisible
    private static final String ENDPOINT = 'callout:Restaurant_API';
    @TestVisible
    private static final Integer TIMEOUT_MS = 120000;
    /** Tests set this to freeze the clock used for the idempotency window. */
    @TestVisible
    private static Long clockMillisOverride;

    // ------------------------------------------------------------------ menu

    public static RestaurantConfigResponse getConfig() {
        return RestaurantApiMapper.config(send('GET', '/agent/config', null, null));
    }

    public static RestaurantMenuResponse getMenu(String category, String subcategory, String searchText, Boolean includeUnavailable) {
        String path = '/agent/menu' + query(category, subcategory, searchText, includeUnavailable);
        return RestaurantApiMapper.menuResponse(send('GET', path, null, null));
    }

    public static RestaurantMenuResponse getCategories() {
        return RestaurantApiMapper.menuResponse(send('GET', '/agent/categories', null, null));
    }

    public static RestaurantMenuResponse getItems(String category, String subcategory, String searchText, Boolean includeUnavailable) {
        String path = '/agent/items' + query(category, subcategory, searchText, includeUnavailable);
        return RestaurantApiMapper.menuResponse(send('GET', path, null, null));
    }

    /** @param itemReference menu item id or slug */
    public static RestaurantItemDetails getItemDetails(String itemReference) {
        if (String.isBlank(itemReference)) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'An item id or slug is required.');
        }
        String path = '/agent/items/' + EncodingUtil.urlEncode(itemReference.trim(), 'UTF-8');
        return RestaurantApiMapper.itemDetails(send('GET', path, null, null));
    }

    // ------------------------------------------------------------------ orders

    public static RestaurantOrderResponse createOrder(RestaurantOrderRequest req) {
        List<String> problems = validateOrder(req);
        if (!problems.isEmpty()) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', String.join(problems, ' '));
        }
        Map<String, Object> body = orderPayload(req);
        Map<String, String> headers = new Map<String, String>{ 'Idempotency-Key' => idempotencyKey(req) };
        return RestaurantApiMapper.orderResponse(send('POST', '/agent/orders', JSON.serialize(body), headers));
    }

    /** Shared, price-free order payload used by the keyed agent route and the guest-safe public route. */
    public static Map<String, Object> orderPayload(RestaurantOrderRequest req) {
        Map<String, Object> body = new Map<String, Object>();
        List<Object> items = new List<Object>();
        for (RestaurantOrderItem i : req.items) {
            Map<String, Object> line = new Map<String, Object>{ 'menuItemId' => i.menuItemId.trim(), 'quantity' => i.quantity };
            if (String.isNotBlank(i.notes)) {
                line.put('notes', i.notes.trim());
            }
            items.add(line);
        }
        Map<String, Object> customer = new Map<String, Object>{ 'name' => req.customerName.trim(), 'phone' => normalisePhone(req.customerPhone) };
        if (String.isNotBlank(req.customerEmail)) {
            customer.put('email', req.customerEmail.trim());
        }
        body.put('items', items);
        body.put('customer', customer);
        body.put('fulfilment', normaliseEnum(req.fulfilment));
        body.put('paymentMethod', normaliseEnum(req.paymentMethod));
        if (normaliseEnum(req.fulfilment) == 'DELIVERY') {
            Map<String, Object> address = new Map<String, Object>{ 'line1' => req.deliveryAddressLine.trim(), 'pincode' => req.deliveryPincode.trim() };
            if (String.isNotBlank(req.deliveryLandmark)) {
                address.put('landmark', req.deliveryLandmark.trim());
            }
            body.put('address', address);
        }
        if (String.isNotBlank(req.notes)) {
            body.put('notes', req.notes.trim());
        }
        if (req.deferCheckout == true) {
            body.put('deferCheckout', true);
        }
        return body;
    }

    /** Starts CARD (payment link) or UPI_QR payment for an unpaid online order. Ownership = the order's phone number. */
    public static RestaurantPaymentStart startPayment(String orderNumber, String customerPhone, String method) {
        String m = normaliseEnum(method);
        if (m != 'CARD' && m != 'UPI_QR') {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'Payment method must be CARD or UPI_QR.');
        }
        lookupBody(orderNumber, customerPhone); // validates both
        // The order number is in the URL. The API rejects unknown body properties, so send only phone + method.
        Map<String, Object> body = new Map<String, Object>{ 'customerPhone' => normalisePhone(customerPhone), 'method' => m };
        Map<String, Object> r = send('POST', '/agent/orders/' + EncodingUtil.urlEncode(orderNumber.trim(), 'UTF-8') + '/payment', JSON.serialize(body), null);
        RestaurantPaymentStart s = new RestaurantPaymentStart();
        s.success = true;
        s.orderNumber = RestaurantApiMapper.str(r, 'orderNumber');
        s.method = RestaurantApiMapper.str(r, 'method');
        s.paymentUrl = RestaurantApiMapper.str(r, 'paymentUrl');
        s.qrImageUrl = RestaurantApiMapper.str(r, 'qrImageUrl');
        s.expiresAt = RestaurantApiMapper.str(r, 'expiresAt');
        return s;
    }

    /** PAID only when the backend recorded a verified Razorpay webhook. */
    public static RestaurantPaymentStatus getPaymentStatus(String orderNumber, String customerPhone) {
        lookupBody(orderNumber, customerPhone); // validates both
        String path = '/agent/orders/' + EncodingUtil.urlEncode(orderNumber.trim(), 'UTF-8') + '/payment-status?phone=' + EncodingUtil.urlEncode(normalisePhone(customerPhone), 'UTF-8');
        Map<String, Object> r = send('GET', path, null, null);
        RestaurantPaymentStatus s = new RestaurantPaymentStatus();
        s.success = true;
        s.orderNumber = RestaurantApiMapper.str(r, 'orderNumber');
        s.status = RestaurantApiMapper.str(r, 'status');
        s.orderStatus = RestaurantApiMapper.str(r, 'orderStatus');
        s.amount = RestaurantApiMapper.dec(r, 'amount');
        s.currencyCode = RestaurantApiMapper.str(r, 'currency');
        s.paidAt = RestaurantApiMapper.str(r, 'paidAt');
        s.expiresAt = RestaurantApiMapper.str(r, 'expiresAt');
        return s;
    }

    public static RestaurantOrderDetails getOrderDetails(String orderNumber, String customerPhone) {
        return RestaurantApiMapper.orderDetails(send('POST', '/agent/orders/details', lookupBody(orderNumber, customerPhone), null));
    }

    public static RestaurantOrderStatusResponse getOrderStatus(String orderNumber, String customerPhone) {
        return RestaurantApiMapper.orderStatus(send('POST', '/agent/orders/status', lookupBody(orderNumber, customerPhone), null));
    }

    public static RestaurantCancellationResponse cancelOrder(String orderNumber, String customerPhone, String reason) {
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(lookupBody(orderNumber, customerPhone));
        if (String.isNotBlank(reason)) {
            body.put('reason', reason.trim());
        }
        return RestaurantApiMapper.cancellation(send('POST', '/agent/orders/cancel', JSON.serialize(body), null));
    }

    // ------------------------------------------------------------------ reservations

    public static RestaurantReservationResponse createReservation(RestaurantReservationRequest req) {
        List<String> problems = new List<String>();
        if (req == null || String.isBlank(req.customerName)) {
            problems.add('Customer name is required.');
        }
        if (req == null || !isValidPhone(req.customerPhone)) {
            problems.add('A valid 10-digit Indian mobile number is required.');
        }
        if (req == null || req.partySize == null || req.partySize < 1 || req.partySize > 60) {
            problems.add('Party size must be between 1 and 60.');
        }
        if (req == null || String.isBlank(req.startsAt)) {
            problems.add('Reservation date and time is required.');
        }
        if (!problems.isEmpty()) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', String.join(problems, ' '));
        }
        Map<String, Object> body = new Map<String, Object>{
            'customer' => new Map<String, Object>{ 'name' => req.customerName.trim(), 'phone' => normalisePhone(req.customerPhone) },
            'partySize' => req.partySize,
            'startsAt' => req.startsAt.trim()
        };
        if (String.isNotBlank(req.notes)) {
            body.put('notes', req.notes.trim());
        }
        return RestaurantApiMapper.reservation(send('POST', '/agent/reservations', JSON.serialize(body), null));
    }

    public static RestaurantReservationResponse getReservation(String reservationId, String customerPhone) {
        return RestaurantApiMapper.reservation(send('POST', '/agent/reservations/details', reservationBody(reservationId, customerPhone), null));
    }

    public static RestaurantReservationResponse cancelReservation(String reservationId, String customerPhone) {
        return RestaurantApiMapper.reservation(send('POST', '/agent/reservations/cancel', reservationBody(reservationId, customerPhone), null));
    }

    // ------------------------------------------------------------------ validation helpers (also used by actions)

    /** Returns a list of human-readable problems; empty when the request is complete. */
    public static List<String> validateOrder(RestaurantOrderRequest req) {
        List<String> p = new List<String>();
        if (req == null) {
            p.add('The order request is empty.');
            return p;
        }
        if (String.isBlank(req.customerName)) {
            p.add('Customer name is required.');
        }
        if (!isValidPhone(req.customerPhone)) {
            p.add('A valid 10-digit Indian mobile number is required.');
        }
        if (req.items == null || req.items.isEmpty()) {
            p.add('At least one item is required.');
        } else {
            for (RestaurantOrderItem i : req.items) {
                if (i == null || String.isBlank(i.menuItemId)) {
                    p.add('Every item needs a menuItemId from the menu.');
                    break;
                }
                if (i.quantity == null || i.quantity < 1 || i.quantity > 50) {
                    p.add('Quantity must be between 1 and 50.');
                    break;
                }
            }
        }
        String f = normaliseEnum(req.fulfilment);
        if (f != 'TAKEAWAY' && f != 'DELIVERY' && f != 'DINE_IN') {
            p.add('Order type must be TAKEAWAY, DELIVERY or DINE_IN.');
        }
        String pay = normaliseEnum(req.paymentMethod);
        if (pay != 'ONLINE' && pay != 'COD') {
            p.add('Payment method must be ONLINE or COD.');
        }
        if (f == 'DELIVERY') {
            if (String.isBlank(req.deliveryAddressLine)) {
                p.add('A delivery address is required for delivery.');
            }
            if (String.isBlank(req.deliveryPincode) || !Pattern.matches('^[0-9]{6}$', req.deliveryPincode.trim())) {
                p.add('A 6-digit delivery pincode is required for delivery.');
            }
        }
        return p;
    }

    /** "dine-in" / "Dine in" -> DINE_IN */
    public static String normaliseEnum(String value) {
        return value == null ? null : value.trim().toUpperCase().replaceAll('[^A-Z]+', '_');
    }

    /** Reduces +91 98765-43210 style input to the 10 digits the API expects. */
    public static String normalisePhone(String phone) {
        if (phone == null) {
            return null;
        }
        String d = phone.replaceAll('[^0-9]', '');
        if (d.length() == 12 && d.startsWith('91')) {
            d = d.substring(2);
        } else if (d.length() == 11 && d.startsWith('0')) {
            d = d.substring(1);
        }
        return d;
    }

    public static Boolean isValidPhone(String phone) {
        String d = normalisePhone(phone);
        return d != null && Pattern.matches('^[6-9][0-9]{9}$', d);
    }

    /**
     * Deterministic key so that an agent retry of the SAME order (same customer, items, type) within a
     * 5-minute window returns the original order instead of creating a duplicate.
     * A caller-supplied key always wins.
     */
    public static String idempotencyKey(RestaurantOrderRequest req) {
        if (String.isNotBlank(req.idempotencyKey)) {
            return req.idempotencyKey.trim();
        }
        List<String> lines = new List<String>();
        for (RestaurantOrderItem i : req.items) {
            lines.add(i.menuItemId + 'x' + i.quantity + ':' + (i.notes == null ? '' : i.notes.trim()));
        }
        lines.sort();
        List<String> parts = new List<String>{
            normalisePhone(req.customerPhone),
            normaliseEnum(req.fulfilment),
            normaliseEnum(req.paymentMethod),
            req.deliveryPincode == null ? '' : req.deliveryPincode.trim(),
            String.join(lines, ',')
        };
        Long nowMs = clockMillisOverride != null ? clockMillisOverride : System.now().getTime();
        Long bucket = nowMs / 300000L;
        Blob digest = Crypto.generateDigest('SHA-256', Blob.valueOf(String.join(parts, '|') + '|' + String.valueOf(bucket)));
        return 'sf-' + EncodingUtil.convertToHex(digest).substring(0, 40);
    }

    // ------------------------------------------------------------------ plumbing

    private static String lookupBody(String orderNumber, String customerPhone) {
        if (String.isBlank(orderNumber)) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'An order number is required.');
        }
        if (!isValidPhone(customerPhone)) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'The phone number the order was placed with is required.');
        }
        return JSON.serialize(new Map<String, Object>{ 'orderNumber' => orderNumber.trim(), 'customerPhone' => normalisePhone(customerPhone) });
    }

    private static String reservationBody(String reservationId, String customerPhone) {
        if (String.isBlank(reservationId)) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'A reservation id is required.');
        }
        if (!isValidPhone(customerPhone)) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'The phone number the reservation was made with is required.');
        }
        return JSON.serialize(new Map<String, Object>{ 'reservationId' => reservationId.trim(), 'customerPhone' => normalisePhone(customerPhone) });
    }

    private static String query(String category, String subcategory, String searchText, Boolean includeUnavailable) {
        List<String> pairs = new List<String>();
        add(pairs, 'category', category);
        add(pairs, 'subcategory', subcategory);
        add(pairs, 'q', searchText);
        if (includeUnavailable == true) {
            pairs.add('includeUnavailable=true');
        }
        return pairs.isEmpty() ? '' : '?' + String.join(pairs, '&');
    }

    private static void add(List<String> pairs, String key, String value) {
        if (String.isNotBlank(value)) {
            pairs.add(key + '=' + EncodingUtil.urlEncode(value.trim(), 'UTF-8'));
        }
    }

    /** One HTTP round trip. Returns the parsed JSON object on 2xx, otherwise throws RestaurantApiException. */
    @TestVisible
    private static Map<String, Object> send(String method, String path, String jsonBody, Map<String, String> headers) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(ENDPOINT + path);
        req.setMethod(method);
        req.setTimeout(TIMEOUT_MS);
        req.setHeader('Accept', 'application/json');
        if (jsonBody != null) {
            req.setHeader('Content-Type', 'application/json');
            req.setBody(jsonBody);
        }
        if (headers != null) {
            for (String k : headers.keySet()) {
                req.setHeader(k, headers.get(k));
            }
        }
        HttpResponse res;
        try {
            res = new Http().send(req);
        } catch (System.CalloutException e) {
            // Include the actual exception for Setup debug logs, but never include request headers or body.
            System.debug(LoggingLevel.ERROR, 'Restaurant API callout failed (' + e.getTypeName() + '): ' + e.getMessage());
            RestaurantApiException failure = new RestaurantApiException(0, 'UNREACHABLE', 'The restaurant system could not be reached. Please try again shortly.');
            failure.errorType = e.getTypeName();
            throw failure;
        }
        Map<String, Object> parsed = parseResponse(res.getBody());
        Integer status = res.getStatusCode();
        if (status >= 200 && status < 300) {
            return parsed;
        }
        System.debug(LoggingLevel.ERROR, 'Restaurant API error ' + status + ': ' + method + ' ' + path.substringBefore('?'));
        throw RestaurantApiException.fromResponse(status, parsed);
    }

    @TestVisible
    public static Map<String, Object> parseResponse(String body) {
        if (String.isBlank(body)) {
            return new Map<String, Object>();
        }
        try {
            Object o = JSON.deserializeUntyped(body);
            return o instanceof Map<String, Object> ? (Map<String, Object>) o : new Map<String, Object>();
        } catch (JSONException e) {
            // e.g. an HTML error page from a proxy
            return new Map<String, Object>();
        }
    }
}
