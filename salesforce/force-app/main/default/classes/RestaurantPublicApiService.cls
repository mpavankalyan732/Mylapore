/** Guest-only transport for the rate-limited public chat API. It never sends an API key. */
public with sharing class RestaurantPublicApiService {
    @TestVisible private static Integer TIMEOUT_MS = 120000;

    public static RestaurantOrderResponse createOrder(RestaurantOrderRequest req) {
        List<String> problems = RestaurantApiService.validateOrder(req);
        if (!problems.isEmpty()) {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', String.join(problems, ' '));
        }
        Map<String, Object> body = RestaurantApiService.orderPayload(req);
        Map<String, String> headers = new Map<String, String>{ 'Idempotency-Key' => RestaurantApiService.idempotencyKey(req) };
        return RestaurantApiMapper.orderResponse(send('POST', '/orders', JSON.serialize(body), headers));
    }

    public static RestaurantPaymentStart startPayment(String orderNumber, String customerPhone, String method) {
        String m = RestaurantApiService.normaliseEnum(method);
        validateLookup(orderNumber, customerPhone);
        if (m != 'CARD' && m != 'UPI_QR') {
            throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'Payment method must be CARD or UPI_QR.');
        }
        Map<String, Object> body = new Map<String, Object>{ 'phone' => RestaurantApiService.normalisePhone(customerPhone), 'method' => m };
        Map<String, Object> r = send('POST', '/orders/' + EncodingUtil.urlEncode(orderNumber.trim(), 'UTF-8') + '/payment', JSON.serialize(body), null);
        RestaurantPaymentStart s = new RestaurantPaymentStart();
        s.success = true;
        s.orderNumber = RestaurantApiMapper.str(r, 'orderNumber');
        s.method = RestaurantApiMapper.str(r, 'method');
        s.paymentUrl = RestaurantApiMapper.str(r, 'paymentUrl');
        s.qrImageUrl = RestaurantApiMapper.str(r, 'qrImageUrl');
        s.expiresAt = RestaurantApiMapper.str(r, 'expiresAt');
        return s;
    }

    public static RestaurantPaymentStatus getPaymentStatus(String orderNumber, String customerPhone) {
        validateLookup(orderNumber, customerPhone);
        String path = '/orders/' + EncodingUtil.urlEncode(orderNumber.trim(), 'UTF-8') + '/payment-status?phone=' + EncodingUtil.urlEncode(RestaurantApiService.normalisePhone(customerPhone), 'UTF-8');
        Map<String, Object> r = send('GET', path, null, null);
        RestaurantPaymentStatus s = new RestaurantPaymentStatus();
        s.success = true;
        s.orderNumber = orderNumber.trim();
        s.status = RestaurantApiMapper.str(r, 'status');
        s.amount = RestaurantApiMapper.dec(r, 'amount');
        s.currencyCode = 'INR';
        s.paidAt = RestaurantApiMapper.str(r, 'paidAt');
        return s;
    }

    private static void validateLookup(String orderNumber, String customerPhone) {
        if (String.isBlank(orderNumber)) throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'An order number is required.');
        if (!RestaurantApiService.isValidPhone(customerPhone)) throw new RestaurantApiException(400, 'VALIDATION_ERROR', 'The phone number the order was placed with is required.');
    }

    @TestVisible
    private static Map<String, Object> send(String method, String path, String body, Map<String, String> headers) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(System.Label.Mylapore_Public_API_Base_Url + path);
        req.setMethod(method);
        req.setTimeout(TIMEOUT_MS);
        req.setHeader('Accept', 'application/json');
        if (body != null) {
            req.setHeader('Content-Type', 'application/json');
            req.setBody(body);
        }
        if (headers != null) for (String key : headers.keySet()) req.setHeader(key, headers.get(key));

        HttpResponse response;
        try {
            response = new Http().send(req);
        } catch (System.CalloutException e) {
            System.debug(LoggingLevel.ERROR, 'Restaurant public API callout failed (' + e.getTypeName() + '): ' + e.getMessage());
            RestaurantApiException failure = new RestaurantApiException(0, 'UNREACHABLE', 'The restaurant system could not be reached. Please try again shortly.');
            failure.errorType = e.getTypeName();
            throw failure;
        }
        Map<String, Object> parsed = RestaurantApiService.parseResponse(response.getBody());
        Integer status = response.getStatusCode();
        if (status >= 200 && status < 300) return parsed;
        throw RestaurantApiException.fromResponse(status, parsed);
    }
}
