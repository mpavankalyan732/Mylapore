@IsTest
private class RestaurantControllersTest {
    private static RestaurantOrderRequest order() {
        RestaurantOrderRequest r = new RestaurantOrderRequest();
        r.customerName = 'Asha';
        r.customerPhone = '9876543210';
        r.fulfilment = 'TAKEAWAY';
        r.paymentMethod = 'COD';
        RestaurantOrderItem i = new RestaurantOrderItem();
        i.menuItemId = 'item-1';
        i.quantity = 1;
        r.items = new List<RestaurantOrderItem>{ i };
        return r;
    }

    private static Map<String, Object> payload(AuraHandledException e) {
        return (Map<String, Object>) JSON.deserializeUntyped(e.getMessage());
    }

    @IsTest
    static void menuController() {
        RestaurantApiMock.install();
        RestaurantMenuResponse m = RestaurantMenuController.getMenu('idli-dosa', null, 'dosa', false);
        System.assertEquals(1, m.categories.size());
        System.assertEquals('Masala Dosa', RestaurantMenuController.getItemDetails('masala-dosa').item.name);
        System.assertEquals(5.0, RestaurantMenuController.getConfig().taxPercent);
    }

    @IsTest
    static void menuControllerErrorsBecomeStructuredAuraMessages() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('GET /agent/menu', 500, '{}');
        RestaurantApiMock.stub('GET /agent/items/', 404, '{"statusCode":404,"message":"Menu item not found"}');
        RestaurantApiMock.stub('GET /agent/config', 500, '{}');
        try {
            RestaurantMenuController.getMenu(null, null, null, null);
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('SERVER_ERROR', payload(e).get('code'));
        }
        try {
            RestaurantMenuController.getItemDetails('x');
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('NOT_FOUND', payload(e).get('code'));
            System.assertEquals('Menu item not found', payload(e).get('message'));
        }
        try {
            RestaurantMenuController.getConfig();
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('SERVER_ERROR', payload(e).get('code'));
        }
    }

    @IsTest
    static void orderIsCopiedToSalesforce() {
        RestaurantApiMock.install();
        RestaurantOrderController.placeOrder(order());
        List<Restaurant_Order__c> saved = [SELECT Customer_Name__c, Status__c, Items_Summary__c FROM Restaurant_Order__c WHERE Order_Number__c = 'VR261111-AB12CD'];
        System.assertEquals(1, saved.size(), 'the placed order is copied to Salesforce');
        System.assertEquals('Asha', saved[0].Customer_Name__c);
        RestaurantOrderResponse again = new RestaurantOrderResponse();
        again.success = true;
        again.orderNumber = 'VR261111-AB12CD';
        again.status = 'CONFIRMED';
        RestaurantOrderRecords.save(order(), again);
        System.assertEquals(1, [SELECT COUNT() FROM Restaurant_Order__c], 'a repeat must not duplicate the record');
        RestaurantOrderResponse failed = new RestaurantOrderResponse();
        failed.success = false;
        RestaurantOrderRecords.save(order(), failed);
        System.assertEquals(1, [SELECT COUNT() FROM Restaurant_Order__c], 'a failed order is never copied');
        RestaurantOrderStatusResponse st = new RestaurantOrderStatusResponse();
        st.success = true;
        st.orderNumber = 'VR261111-AB12CD';
        st.status = 'PREPARING';
        st.paymentStatus = 'PAID';
        RestaurantOrderRecords.updateStatus(st);
        System.assertEquals('PAID', [SELECT Payment_Status__c FROM Restaurant_Order__c LIMIT 1].Payment_Status__c);
        RestaurantOrderItem it = new RestaurantOrderItem();
        it.name = 'Idly';
        it.quantity = 2;
        it.lineTotal = 60;
        System.assertEquals('2 x Idly = 60', RestaurantOrderRecords.summary(new List<RestaurantOrderItem>{ it }));
        RestaurantCancellationResponse c = new RestaurantCancellationResponse();
        c.cancelled = true;
        c.orderNumber = 'VR261111-AB12CD';
        c.status = 'CANCELLED';
        RestaurantOrderRecords.markCancelled(c);
        System.assertEquals('CANCELLED', [SELECT Status__c FROM Restaurant_Order__c LIMIT 1].Status__c);
    }

    // Each call is its own test: the Salesforce copy is DML, and DML before a callout in one transaction is not allowed.
    @IsTest
    static void orderDetails() {
        RestaurantApiMock.install();
        System.assertEquals('VR261111-AB12CD', RestaurantOrderController.getOrderDetails('VR261111-AB12CD', '9876543210').orderNumber);
    }

    @IsTest
    static void orderStatus() {
        RestaurantApiMock.install();
        System.assertEquals('PREPARING', RestaurantOrderController.getOrderStatus('VR261111-AB12CD', '9876543210').status);
    }

    @IsTest
    static void orderCancel() {
        RestaurantApiMock.install();
        System.assertEquals(true, RestaurantOrderController.cancelOrder('VR261111-AB12CD', '9876543210', null, true).cancelled);
    }

    @IsTest
    static void orderControllerErrors() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('POST /agent/orders', 409, '{"statusCode":409,"code":"ITEM_UNAVAILABLE","message":"Some items are no longer available","itemIds":["item-1"]}');
        try {
            RestaurantOrderController.placeOrder(order());
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            Map<String, Object> p = payload(e);
            System.assertEquals('ITEM_UNAVAILABLE', p.get('code'));
            System.assertEquals('item-1', ((List<Object>) p.get('itemIds'))[0], 'the component learns which dishes to flag');
        }
        try {
            RestaurantOrderController.cancelOrder('VR261111-AB12CD', '9876543210', null, false);
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('VALIDATION_ERROR', payload(e).get('code'));
        }
        System.assertEquals(1, RestaurantApiMock.callCount, 'cancel without confirmation never reached the API');

        RestaurantApiMock.stub('POST /agent/orders/details', 404, '{"statusCode":404,"message":"Order not found"}');
        RestaurantApiMock.stub('POST /agent/orders/status', 404, '{"statusCode":404,"message":"Order not found"}');
        RestaurantApiMock.stub('POST /agent/orders/cancel', 404, '{"statusCode":404,"message":"Order not found"}');
        try {
            RestaurantOrderController.getOrderDetails('X', '9876543210');
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('NOT_FOUND', payload(e).get('code'));
        }
        try {
            RestaurantOrderController.getOrderStatus('X', '9876543210');
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('NOT_FOUND', payload(e).get('code'));
        }
        try {
            RestaurantOrderController.cancelOrder('X', '9876543210', null, true);
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('NOT_FOUND', payload(e).get('code'));
        }
    }

    @IsTest
    static void reservationController() {
        RestaurantApiMock.install();
        RestaurantReservationRequest rr = new RestaurantReservationRequest();
        rr.customerName = 'Asha';
        rr.customerPhone = '9876543210';
        rr.partySize = 4;
        rr.startsAt = '2026-12-01T19:30:00+05:30';
        System.assertEquals('REQUESTED', RestaurantOrderController.createReservation(rr).status);
        System.assertEquals('REQUESTED', RestaurantOrderController.getReservation('11111111-1111-1111-1111-111111111111', '9876543210').status);
        System.assertEquals(true, RestaurantOrderController.cancelReservation('11111111-1111-1111-1111-111111111111', '9876543210', true).cancelled);
        try {
            RestaurantOrderController.cancelReservation('11111111-1111-1111-1111-111111111111', '9876543210', false);
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('VALIDATION_ERROR', payload(e).get('code'));
        }
        RestaurantApiMock.stub('POST /agent/reservations', 422, '{"statusCode":422,"message":"Reservation time must be in the future"}');
        try {
            RestaurantOrderController.createReservation(rr);
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('UNPROCESSABLE', payload(e).get('code'));
        }
        RestaurantApiMock.stub('POST /agent/reservations/details', 404, '{"statusCode":404,"message":"Reservation not found"}');
        try {
            RestaurantOrderController.getReservation('x', '9876543210');
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('NOT_FOUND', payload(e).get('code'));
        }
        RestaurantApiMock.stub('POST /agent/reservations/cancel', 404, '{"statusCode":404,"message":"Reservation not found"}');
        try {
            RestaurantOrderController.cancelReservation('x', '9876543210', true);
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assertEquals('NOT_FOUND', payload(e).get('code'));
        }
    }
}
