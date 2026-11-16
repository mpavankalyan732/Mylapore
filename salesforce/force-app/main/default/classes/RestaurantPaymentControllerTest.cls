@IsTest
private class RestaurantPaymentControllerTest {
    private class Stub implements HttpCalloutMock {
        Integer status;
        String body;
        Stub(Integer status, String body) {
            this.status = status;
            this.body = body;
        }
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(status);
            res.setBody(body);
            return res;
        }
    }

    private static final String CART = '[{"menuItemId":"item-1","quantity":1}]';

    private static String failureOf(String cart) {
        try {
            RestaurantPaymentController.createPaymentLink(cart);
        } catch (AuraHandledException e) {
            return e.getMessage();
        }
        return null;
    }

    @IsTest
    static void returnsRazorpayLink() {
        Test.setMock(HttpCalloutMock.class, new Stub(200, '{"checkoutUrl":"https://rzp.io/i/abc"}'));
        System.assertEquals('https://rzp.io/i/abc', RestaurantPaymentController.createPaymentLink(CART));
    }

    @IsTest
    static void rejectsUnsafeOrMissingLink() {
        Test.setMock(HttpCalloutMock.class, new Stub(200, '{"checkoutUrl":"http://evil.example/pay"}'));
        System.assertNotEquals(null, failureOf(CART));
    }

    @IsTest
    static void rejectsBackendError() {
        Test.setMock(HttpCalloutMock.class, new Stub(500, '{}'));
        System.assertNotEquals(null, failureOf(CART));
    }

    @IsTest
    static void rejectsEmptyCart() {
        System.assertNotEquals(null, failureOf(''));
        System.assertNotEquals(null, failureOf('[]'));
    }
}
