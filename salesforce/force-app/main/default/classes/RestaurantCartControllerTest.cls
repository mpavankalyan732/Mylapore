@IsTest
private class RestaurantCartControllerTest {
    private static final String ORDER_NO = 'VR261111-AB12CD';
    private static final String PHONE = '9876543210';

    private static String requestJson(String fulfilment) {
        return JSON.serialize(new Map<String, Object>{
            'customerName' => 'Asha',
            'customerPhone' => PHONE,
            'customerEmail' => 'asha@example.com',
            'fulfilment' => fulfilment,
            'paymentMethod' => 'ONLINE',
            'deliveryAddressLine' => '12 Temple Street',
            'deliveryPincode' => '517501',
            'items' => new List<Object>{
                new Map<String, Object>{ 'menuItemId' => 'item-1', 'quantity' => 2, 'notes' => 'less spicy', 'unitPrice' => 1, 'lineTotal' => 1 }
            }
        });
    }

    private static String failureOf(String json) {
        try {
            RestaurantCartController.createOrder(json);
        } catch (AuraHandledException e) {
            return e.getMessage();
        }
        return null;
    }

    // Each callout is its own test: the Salesforce copy is DML, and DML before a callout in one transaction is not allowed.
    @IsTest
    static void createOrderSavesCustomerOrderAndItems() {
        RestaurantApiMock.install();
        RestaurantOrderResponse res = RestaurantCartController.createOrder(requestJson('TAKEAWAY'));
        System.assertEquals(ORDER_NO, res.orderNumber);

        String body = RestaurantApiMock.lastRequest.getBody();
        Map<String, Object> sent = (Map<String, Object>) JSON.deserializeUntyped(body);
        System.assertEquals(true, sent.get('deferCheckout'), 'the card chooses card/QR after the order exists');
        System.assert(!body.contains('unitPrice'), 'prices are never sent to the backend');
        System.assert(!body.contains('lineTotal'), 'prices are never sent to the backend');

        List<Restaurant_Customer__c> customers = [SELECT Name, Phone__c, Email__c, Last_Order_Date__c FROM Restaurant_Customer__c];
        System.assertEquals(1, customers.size());
        System.assertEquals(PHONE, customers[0].Phone__c);
        System.assertNotEquals(null, customers[0].Last_Order_Date__c);
        Restaurant_Order__c o = [SELECT Customer__c, Customer_Name__c, Total__c, (SELECT Item_Name__c, Quantity__c FROM Order_Items__r) FROM Restaurant_Order__c];
        System.assertEquals(customers[0].Id, o.Customer__c, 'the order is linked to the customer');
        System.assert(!o.Order_Items__r.isEmpty(), 'item rows are created');
    }

    @IsTest
    static void guestCheckoutUsesPublicEndpointWithoutCredential() {
        RestaurantApiMock.install();
        RestaurantCartController.guestContextOverride = true;
        RestaurantOrderResponse response = RestaurantCartController.createOrder(requestJson('TAKEAWAY'));
        System.assertEquals(ORDER_NO, response.orderNumber);
        System.assert(RestaurantApiMock.lastRequest.getEndpoint().startsWith('https://mylapore-api.onrender.com/api/v1/public/chat/orders'));
        System.assertEquals(null, RestaurantApiMock.lastRequest.getHeader('x-api-key'));
        System.assertEquals(null, RestaurantApiMock.lastRequest.getHeader('Authorization'));
        System.assertEquals(120000, RestaurantPublicApiService.TIMEOUT_MS);
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(RestaurantApiMock.lastRequest.getBody());
        System.assertEquals(true, body.get('deferCheckout'));
        System.assert(!RestaurantApiMock.lastRequest.getBody().contains('unitPrice'));
        RestaurantCartController.guestContextOverride = null;
    }

    @IsTest
    static void returningGuestReusesTheCustomerRecord() {
        RestaurantApiMock.install();
        RestaurantCartController.createOrder(requestJson('TAKEAWAY'));
        RestaurantOrderResponse second = new RestaurantOrderResponse();
        second.success = true;
        second.orderNumber = 'VR261111-ZZ99ZZ';
        RestaurantOrderRequest req = (RestaurantOrderRequest) JSON.deserialize(requestJson('TAKEAWAY'), RestaurantOrderRequest.class);
        RestaurantOrderSync.save(req, second);
        System.assertEquals(1, [SELECT COUNT() FROM Restaurant_Customer__c], 'same phone, same customer');
        System.assertEquals(2, [SELECT COUNT() FROM Restaurant_Order__c]);
    }

    @IsTest
    static void deliveryRequiresAddressAndPincode() {
        Map<String, Object> m = (Map<String, Object>) JSON.deserializeUntyped(requestJson('DELIVERY'));
        m.put('deliveryPincode', '12');
        String msg = failureOf(JSON.serialize(m));
        System.assertNotEquals(null, msg);
        System.assert(msg.contains('pincode'));
    }

    @IsTest
    static void rejectsUnreadableOrOversizedInput() {
        System.assertNotEquals(null, failureOf(null));
        System.assertNotEquals(null, failureOf('not json'));
        System.assertNotEquals(null, failureOf('x'.repeat(20001)));
    }

    @IsTest
    static void rejectsBadPhone() {
        Map<String, Object> m = (Map<String, Object>) JSON.deserializeUntyped(requestJson('TAKEAWAY'));
        m.put('customerPhone', '12345');
        System.assertNotEquals(null, failureOf(JSON.serialize(m)));
    }

    @IsTest
    static void startPaymentReturnsQr() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('POST /agent/orders/' + ORDER_NO + '/payment', 200,
            '{"orderNumber":"' + ORDER_NO + '","method":"UPI_QR","paymentUrl":null,"qrImageUrl":"https://rzp.io/i/qr.png","qrId":"qr_1","expiresAt":"2026-11-17T10:15:00.000Z"}');
        RestaurantPaymentStart s = RestaurantCartController.startPayment(ORDER_NO, PHONE, 'UPI_QR');
        System.assertEquals('https://rzp.io/i/qr.png', s.qrImageUrl);
        Map<String, Object> sent = (Map<String, Object>) JSON.deserializeUntyped(RestaurantApiMock.lastRequest.getBody());
        System.assertEquals('UPI_QR', sent.get('method'));
        System.assert(!sent.containsKey('orderNumber'), 'the API rejects unknown body properties: the order number is only in the URL');
        System.assertEquals(2, sent.size());
    }

    @IsTest
    static void startPaymentRefusesInsecureUrls() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('POST /agent/orders/' + ORDER_NO + '/payment', 200,
            '{"orderNumber":"' + ORDER_NO + '","method":"CARD","paymentUrl":"http://evil.example/pay"}');
        try {
            RestaurantCartController.startPayment(ORDER_NO, PHONE, 'CARD');
            System.assert(false, 'an http payment url must be refused');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('not secure'));
        }
    }

    @IsTest
    static void startPaymentRefusesUnknownMethods() {
        RestaurantApiMock.install();
        try {
            RestaurantCartController.startPayment(ORDER_NO, PHONE, 'BITCOIN');
            System.assert(false, 'unknown method');
        } catch (AuraHandledException e) {
            System.assertNotEquals(null, e.getMessage());
        }
    }

    @IsTest
    static void pendingPaymentNeverMarksPaid() {
        insert new Restaurant_Order__c(Order_Number__c = ORDER_NO, Payment_Status__c = 'PENDING', Status__c = 'PENDING_PAYMENT');
        RestaurantApiMock.install();
        RestaurantApiMock.stub('GET /agent/orders/' + ORDER_NO + '/payment-status', 200,
            '{"orderNumber":"' + ORDER_NO + '","status":"PENDING_PAYMENT","amount":189,"currency":"INR","paidAt":null,"expiresAt":"2026-11-17T10:15:00.000Z","orderStatus":"PENDING_PAYMENT"}');
        // The insert above is DML before a callout, so run the callout in a fresh transaction context.
        Test.startTest();
        RestaurantPaymentStatus pending = RestaurantCartController.getPaymentStatus(ORDER_NO, PHONE);
        Test.stopTest();
        System.assertEquals('PENDING_PAYMENT', pending.status);
        System.assertEquals('PENDING', [SELECT Payment_Status__c FROM Restaurant_Order__c].Payment_Status__c, 'pending never marks paid');
    }

    @IsTest
    static void paidIsCopiedOnlyFromTheBackendAnswer() {
        insert new Restaurant_Order__c(Order_Number__c = ORDER_NO, Payment_Status__c = 'PENDING', Status__c = 'PENDING_PAYMENT');
        RestaurantPaymentStatus p = new RestaurantPaymentStatus();
        p.success = true;
        p.orderNumber = ORDER_NO;
        p.status = 'PAID';
        p.orderStatus = 'CONFIRMED';
        p.paidAt = '2026-11-17T10:05:00.000Z';
        RestaurantOrderSync.updatePayment(p);
        Restaurant_Order__c o = [SELECT Payment_Status__c, Status__c, Paid_At__c FROM Restaurant_Order__c];
        System.assertEquals('PAID', o.Payment_Status__c);
        System.assertEquals('CONFIRMED', o.Status__c);
        System.assertNotEquals(null, o.Paid_At__c);

        RestaurantPaymentStatus expired = new RestaurantPaymentStatus();
        expired.success = true;
        expired.orderNumber = ORDER_NO;
        expired.status = 'EXPIRED';
        RestaurantOrderSync.updatePayment(expired);
        System.assertEquals('EXPIRED', [SELECT Payment_Status__c FROM Restaurant_Order__c].Payment_Status__c, 'an expired answer is recorded, and is never PAID');
    }

    @IsTest
    static void getPaymentStatusSurfacesBackendErrors() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('GET /agent/orders/' + ORDER_NO + '/payment-status', 404, '{"message":"Order not found"}');
        try {
            RestaurantCartController.getPaymentStatus(ORDER_NO, PHONE);
            System.assert(false, 'expected an error');
        } catch (AuraHandledException e) {
            System.assertNotEquals(null, e.getMessage());
        }
    }
}
