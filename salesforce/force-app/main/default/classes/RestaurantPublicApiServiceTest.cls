@IsTest
private class RestaurantPublicApiServiceTest {
    private static RestaurantOrderRequest request() {
        RestaurantOrderRequest r = new RestaurantOrderRequest();
        r.customerName = 'Asha';
        r.customerPhone = '9876543210';
        r.fulfilment = 'TAKEAWAY';
        r.paymentMethod = 'ONLINE';
        r.deferCheckout = true;
        r.idempotencyKey = 'guest-order-1234';
        RestaurantOrderItem item = new RestaurantOrderItem();
        item.menuItemId = 'item-1';
        item.quantity = 2;
        item.unitPrice = 1;
        item.lineTotal = 2;
        r.items = new List<RestaurantOrderItem>{ item };
        return r;
    }

    @IsTest
    static void createOrderUsesPublicUrlAndSendsNoCredentialOrPrice() {
        RestaurantApiMock.install();
        RestaurantOrderResponse result = RestaurantPublicApiService.createOrder(request());
        HttpRequest sent = RestaurantApiMock.lastRequest;
        System.assertEquals('VR261111-AB12CD', result.orderNumber);
        System.assert(sent.getEndpoint().startsWith('https://mylapore-api.onrender.com/api/v1/public/chat/orders'));
        System.assertEquals('guest-order-1234', sent.getHeader('Idempotency-Key'));
        System.assertEquals(null, sent.getHeader('x-api-key'));
        System.assertEquals(120000, RestaurantPublicApiService.TIMEOUT_MS);
        System.assert(!sent.getBody().contains('unitPrice'));
        System.assert(!sent.getBody().contains('lineTotal'));
    }

    @IsTest
    static void paymentCallsIncludePhoneAndNeverSendApiKey() {
        RestaurantApiMock.install();
        RestaurantPaymentStart start = RestaurantPublicApiService.startPayment('VR1', '9876543210', 'CARD');
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(RestaurantApiMock.lastRequest.getBody());
        System.assertEquals('9876543210', body.get('phone'));
        System.assertEquals('CARD', start.method);
        System.assertEquals(null, RestaurantApiMock.lastRequest.getHeader('x-api-key'));

        RestaurantPaymentStatus status = RestaurantPublicApiService.getPaymentStatus('VR1', '9876543210');
        System.assertEquals('PENDING_PAYMENT', status.status);
        System.assert(RestaurantApiMock.lastRequest.getEndpoint().endsWith('/orders/VR1/payment-status?phone=9876543210'));
    }

    @IsTest
    static void connectivityErrorStaysGenericAndCarriesDiagnosticType() {
        RestaurantApiMock.install();
        RestaurantApiMock.throwCalloutException = true;
        try {
            RestaurantPublicApiService.createOrder(request());
            System.assert(false, 'expected a callout exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('UNREACHABLE', e.errorCode);
            System.assertEquals('System.CalloutException', e.errorType);
            System.assert(!e.getMessage().contains('timed out'));
        }
    }
}
