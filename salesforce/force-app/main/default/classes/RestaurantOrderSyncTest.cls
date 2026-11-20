@IsTest
private class RestaurantOrderSyncTest {
    private static RestaurantOrderResponse response(String orderNumber) {
        RestaurantOrderResponse r = new RestaurantOrderResponse();
        r.success = true;
        r.orderNumber = orderNumber;
        r.status = 'PENDING_PAYMENT';
        r.paymentStatus = 'PENDING';
        r.paymentMethod = 'ONLINE';
        r.fulfilment = 'DELIVERY';
        r.currencyCode = 'INR';
        r.subtotal = 100;
        r.tax = 5;
        r.deliveryFee = 30;
        r.total = 135;
        RestaurantOrderItem i = new RestaurantOrderItem();
        i.menuItemId = 'item-1';
        i.name = 'Masala Dosa';
        i.quantity = 2;
        i.unitPrice = 50;
        i.lineTotal = 100;
        r.items = new List<RestaurantOrderItem>{ i };
        return r;
    }

    private static RestaurantOrderRequest request() {
        RestaurantOrderRequest q = new RestaurantOrderRequest();
        q.customerName = 'Asha';
        q.customerPhone = '+91 98765 43210';
        q.fulfilment = 'DELIVERY';
        q.deliveryAddressLine = '12 Temple Street';
        q.deliveryPincode = '517501';
        return q;
    }

    @IsTest
    static void savesCustomerOrderItemsAndDeliveryDetails() {
        RestaurantOrderSync.save(request(), response('VR1'));
        Restaurant_Order__c o = [SELECT Customer__r.Phone__c, Delivery_Address__c, Delivery_Pincode__c, Total__c, (SELECT Line_Total__c FROM Order_Items__r) FROM Restaurant_Order__c];
        System.assertEquals('9876543210', o.Customer__r.Phone__c, 'phone is normalised');
        System.assertEquals('12 Temple Street', o.Delivery_Address__c);
        System.assertEquals('517501', o.Delivery_Pincode__c);
        System.assertEquals(135, o.Total__c);
        System.assertEquals(1, o.Order_Items__r.size());
    }

    @IsTest
    static void savingAgainReplacesItemsInsteadOfDuplicating() {
        RestaurantOrderSync.save(request(), response('VR1'));
        RestaurantOrderSync.save(request(), response('VR1'));
        System.assertEquals(1, [SELECT COUNT() FROM Restaurant_Order__c]);
        System.assertEquals(1, [SELECT COUNT() FROM Restaurant_Order_Item__c]);
        System.assertEquals(1, [SELECT COUNT() FROM Restaurant_Customer__c]);
    }

    @IsTest
    static void failedOrNumberlessResponsesAreNeverSaved() {
        RestaurantOrderResponse failed = response('VR1');
        failed.success = false;
        RestaurantOrderSync.save(request(), failed);
        RestaurantOrderSync.save(request(), response(null));
        RestaurantOrderSync.save(request(), null);
        System.assertEquals(0, [SELECT COUNT() FROM Restaurant_Order__c]);
    }

    @IsTest
    static void statusPaymentStartAndCancellationUpdates() {
        RestaurantOrderSync.save(request(), response('VR1'));
        RestaurantOrderStatusResponse st = new RestaurantOrderStatusResponse();
        st.success = true;
        st.orderNumber = 'VR1';
        st.status = 'PREPARING';
        st.paymentStatus = 'PAID';
        RestaurantOrderSync.updateStatus(st);
        System.assertEquals('PREPARING', [SELECT Status__c FROM Restaurant_Order__c].Status__c);

        RestaurantPaymentStart ps = new RestaurantPaymentStart();
        ps.success = true;
        ps.orderNumber = 'VR1';
        ps.method = 'UPI_QR';
        RestaurantOrderSync.markPaymentStarted(ps);
        System.assertEquals('UPI_QR', [SELECT Razorpay_Reference__c FROM Restaurant_Order__c].Razorpay_Reference__c);

        RestaurantCancellationResponse c = new RestaurantCancellationResponse();
        c.cancelled = false;
        c.orderNumber = 'VR1';
        RestaurantOrderSync.markCancelled(c);
        System.assertEquals('PREPARING', [SELECT Status__c FROM Restaurant_Order__c].Status__c, 'not cancelled unless the backend says so');
        c.cancelled = true;
        RestaurantOrderSync.markCancelled(c);
        System.assertEquals('CANCELLED', [SELECT Status__c FROM Restaurant_Order__c].Status__c);
    }

    @IsTest
    static void itemsCarryTheCustomerAndFollowThePaymentOutcome() {
        RestaurantOrderSync.save(request(), response('VR1'));
        Restaurant_Order_Item__c item = [SELECT Status__c, Customer__r.Phone__c FROM Restaurant_Order_Item__c];
        System.assertEquals('PENDING', item.Status__c, 'waiting for payment');
        System.assertEquals('9876543210', item.Customer__r.Phone__c, 'the dish belongs to the customer who ordered it');

        RestaurantPaymentStatus p = new RestaurantPaymentStatus();
        p.success = true;
        p.orderNumber = 'VR1';
        p.status = 'PENDING_PAYMENT';
        RestaurantOrderSync.updatePayment(p);
        System.assertEquals('PENDING', [SELECT Status__c FROM Restaurant_Order_Item__c].Status__c, 'pending changes nothing');

        p.status = 'EXPIRED';
        RestaurantOrderSync.updatePayment(p);
        System.assertEquals(null, RestaurantOrderSync.lastError, 'sync error');
        System.assertEquals('EXPIRED', [SELECT Status__c FROM Restaurant_Order_Item__c].Status__c);
        System.assertEquals('EXPIRED', [SELECT Payment_Status__c FROM Restaurant_Order__c].Payment_Status__c);

        p.status = 'FAILED';
        RestaurantOrderSync.updatePayment(p);
        System.assertEquals('FAILED', [SELECT Status__c FROM Restaurant_Order_Item__c].Status__c);

        p.status = 'PAID';
        p.orderStatus = 'CONFIRMED';
        RestaurantOrderSync.updatePayment(p);
        System.assertEquals('SUCCESS', [SELECT Status__c FROM Restaurant_Order_Item__c].Status__c);

        RestaurantCancellationResponse c = new RestaurantCancellationResponse();
        c.cancelled = true;
        c.orderNumber = 'VR1';
        RestaurantOrderSync.markCancelled(c);
        System.assertEquals('CANCELLED', [SELECT Status__c FROM Restaurant_Order_Item__c].Status__c);
    }

    @IsTest
    static void outcomeMapping() {
        System.assertEquals('SUCCESS', RestaurantOrderSync.outcome('CONFIRMED', 'PAID'));
        System.assertEquals('SUCCESS', RestaurantOrderSync.outcome('CONFIRMED', 'COD_PENDING'));
        System.assertEquals('PENDING', RestaurantOrderSync.outcome('PENDING_PAYMENT', 'PENDING'));
        System.assertEquals('FAILED', RestaurantOrderSync.outcome('PAYMENT_FAILED', 'FAILED'));
        System.assertEquals('EXPIRED', RestaurantOrderSync.outcome('EXPIRED', 'EXPIRED'));
        System.assertEquals('CANCELLED', RestaurantOrderSync.outcome('CANCELLED', 'PAID'));
    }

    @IsTest
    static void summaryListsItems() {
        System.assertEquals('2 x Masala Dosa = 100', RestaurantOrderSync.summary(response('VR1').items));
        System.assertEquals('', RestaurantOrderSync.summary(null));
    }
}
