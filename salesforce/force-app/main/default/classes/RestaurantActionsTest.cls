@IsTest
private class RestaurantActionsTest {
    private static RestaurantOrderRequest order() {
        RestaurantOrderRequest r = new RestaurantOrderRequest();
        r.customerName = 'Asha';
        r.customerPhone = '9876543210';
        r.fulfilment = 'TAKEAWAY';
        r.paymentMethod = 'COD';
        RestaurantOrderItem i = new RestaurantOrderItem();
        i.menuItemId = 'item-1';
        i.quantity = 2;
        r.items = new List<RestaurantOrderItem>{ i };
        return r;
    }

    // ------------------------------------------------------------------ menu actions

    @IsTest
    static void menuActions() {
        RestaurantApiMock.install();
        RestaurantMenuAction.Request mr = new RestaurantMenuAction.Request();
        mr.category = 'idli-dosa';
        List<RestaurantMenuAction.Response> menu = RestaurantMenuAction.getRestaurantMenu(new List<RestaurantMenuAction.Request>{ mr });
        System.assertEquals(true, menu[0].menu.success);
        System.assertEquals('Masala Dosa', menu[0].menu.categories[0].items[0].name);
        System.assert(RestaurantApiMock.lastRequest.getEndpoint().contains('category=idli-dosa'));

        List<RestaurantCategoryAction.Response> cats = RestaurantCategoryAction.getMenuCategories(
            new List<RestaurantCategoryAction.Request>{ new RestaurantCategoryAction.Request() }
        );
        System.assertEquals('Idli & Dosa', cats[0].menu.categories[0].name);

        RestaurantMenuItemAction.Request ir = new RestaurantMenuItemAction.Request();
        ir.searchText = 'dosa';
        List<RestaurantMenuItemAction.Response> items = RestaurantMenuItemAction.getMenuItems(new List<RestaurantMenuItemAction.Request>{ ir });
        System.assertEquals(1, items[0].menu.items.size());
        System.assert(RestaurantApiMock.lastRequest.getEndpoint().contains('q=dosa'));

        RestaurantItemDetailsAction.Request dr = new RestaurantItemDetailsAction.Request();
        dr.itemReference = 'masala-dosa';
        List<RestaurantItemDetailsAction.Response> d = RestaurantItemDetailsAction.getMenuItemDetails(new List<RestaurantItemDetailsAction.Request>{ dr });
        System.assertEquals('Masala Dosa', d[0].details.item.name);
        System.assertEquals(90.0, d[0].details.item.price);
    }

    @IsTest
    static void menuActionsReportFailuresInsteadOfThrowing() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('GET /agent/menu', 500, '{}');
        RestaurantApiMock.stub('GET /agent/categories', 500, '{}');
        RestaurantApiMock.stub('GET /agent/items', 500, '{}');
        List<RestaurantMenuAction.Response> menu = RestaurantMenuAction.getRestaurantMenu(new List<RestaurantMenuAction.Request>{ new RestaurantMenuAction.Request() });
        System.assertEquals(false, menu[0].menu.success);
        System.assertEquals('SERVER_ERROR', menu[0].menu.errorCode);
        System.assert(menu[0].menu.categories.isEmpty(), 'no invented data on failure');
        System.assertEquals(false, RestaurantCategoryAction.getMenuCategories(new List<RestaurantCategoryAction.Request>{ new RestaurantCategoryAction.Request() })[0].menu.success);
        System.assertEquals(false, RestaurantMenuItemAction.getMenuItems(new List<RestaurantMenuItemAction.Request>{ new RestaurantMenuItemAction.Request() })[0].menu.success);

        RestaurantItemDetailsAction.Request dr = new RestaurantItemDetailsAction.Request();
        dr.itemReference = 'nope';
        RestaurantApiMock.stub('GET /agent/items/', 404, '{"statusCode":404,"message":"Menu item not found"}');
        List<RestaurantItemDetailsAction.Response> d = RestaurantItemDetailsAction.getMenuItemDetails(new List<RestaurantItemDetailsAction.Request>{ dr });
        System.assertEquals(false, d[0].details.success);
        System.assertEquals('NOT_FOUND', d[0].details.errorCode);
        System.assertEquals(null, d[0].details.item, 'no invented item on failure');
    }

    // ------------------------------------------------------------------ create order

    @IsTest
    static void createOrderRequiresExplicitCustomerConfirmation() {
        RestaurantApiMock.install();
        RestaurantOrderAction.Request r = new RestaurantOrderAction.Request();
        r.orderRequest = order();
        r.customerConfirmed = false;
        List<RestaurantOrderAction.Response> out = RestaurantOrderAction.createRestaurantOrder(new List<RestaurantOrderAction.Request>{ r });
        System.assertEquals(false, out[0].order.success);
        System.assertEquals('CONFIRMATION_REQUIRED', out[0].order.errorCode);
        System.assertEquals(null, out[0].order.orderNumber, 'no order number is ever invented');
        System.assertEquals(0, RestaurantApiMock.callCount, 'the API must not be called without confirmation');
    }

    @IsTest
    static void createOrderSuccess() {
        RestaurantApiMock.install();
        RestaurantOrderAction.Request r = new RestaurantOrderAction.Request();
        r.orderRequest = order();
        r.customerConfirmed = true;
        RestaurantOrderResponse o = RestaurantOrderAction.createRestaurantOrder(new List<RestaurantOrderAction.Request>{ r })[0].order;
        System.assertEquals(true, o.success);
        System.assertEquals('VR261111-AB12CD', o.orderNumber);
        System.assertEquals(189.0, o.total, 'total comes from the backend');
    }

    @IsTest
    static void createOrderOnlineReturnsCheckoutLink() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('POST /agent/orders', 201, RestaurantApiMock.ORDER_ONLINE);
        RestaurantOrderAction.Request r = new RestaurantOrderAction.Request();
        r.orderRequest = order();
        r.orderRequest.paymentMethod = 'ONLINE';
        r.customerConfirmed = true;
        RestaurantOrderResponse o = RestaurantOrderAction.createRestaurantOrder(new List<RestaurantOrderAction.Request>{ r })[0].order;
        System.assertEquals('PENDING_PAYMENT', o.status);
        System.assertEquals('OPEN_CHECKOUT', o.nextAction);
        System.assertEquals('https://pay.example.com/x', o.checkoutUrl);
    }

    @IsTest
    static void createOrderFailuresAreReportedHonestly() {
        RestaurantApiMock.install();
        RestaurantOrderAction.Request r = new RestaurantOrderAction.Request();
        r.orderRequest = order();
        r.customerConfirmed = true;

        RestaurantApiMock.stub('POST /agent/orders', 409, '{"statusCode":409,"code":"ITEM_UNAVAILABLE","message":"Some items are no longer available","itemIds":["item-1"]}');
        RestaurantOrderResponse o = RestaurantOrderAction.createRestaurantOrder(new List<RestaurantOrderAction.Request>{ r })[0].order;
        System.assertEquals(false, o.success);
        System.assertEquals('ITEM_UNAVAILABLE', o.errorCode);
        System.assertEquals('item-1', o.unavailableItemIds[0]);
        System.assertEquals(null, o.orderNumber);

        RestaurantApiMock.stub('POST /agent/orders', 422, '{"statusCode":422,"code":"DELIVERY_OUT_OF_AREA","message":"We do not deliver to this pincode yet"}');
        System.assertEquals('DELIVERY_OUT_OF_AREA', RestaurantOrderAction.createRestaurantOrder(new List<RestaurantOrderAction.Request>{ r })[0].order.errorCode);

        r.orderRequest.customerName = null;
        RestaurantOrderResponse invalid = RestaurantOrderAction.createRestaurantOrder(new List<RestaurantOrderAction.Request>{ r })[0].order;
        System.assertEquals('VALIDATION_ERROR', invalid.errorCode);

        RestaurantApiMock.throwCalloutException = true;
        r.orderRequest = order();
        System.assertEquals('UNREACHABLE', RestaurantOrderAction.createRestaurantOrder(new List<RestaurantOrderAction.Request>{ r })[0].order.errorCode);
    }

    // ------------------------------------------------------------------ charges and options

    @IsTest
    static void chargesActionReturnsBackendConfigAndReportsFailures() {
        RestaurantApiMock.install();
        RestaurantConfigResponse c = RestaurantConfigAction.getRestaurantCharges(new List<RestaurantConfigAction.Request>{ new RestaurantConfigAction.Request() })[0].config;
        System.assertEquals(true, c.success);
        System.assertEquals(5.0, c.taxPercent);
        System.assertEquals(30.0, c.deliveryFee);
        System.assert(c.fulfilmentOptions.contains('DELIVERY'));
        RestaurantApiMock.stub('GET /agent/config', 500, '{}');
        RestaurantConfigResponse failed = RestaurantConfigAction.getRestaurantCharges(new List<RestaurantConfigAction.Request>{ new RestaurantConfigAction.Request() })[0].config;
        System.assertEquals(false, failed.success);
        System.assertEquals(null, failed.taxPercent, 'no invented charges on failure');
    }

    // ------------------------------------------------------------------ order details / status

    @IsTest
    static void orderDetailsAndStatus() {
        RestaurantApiMock.install();
        RestaurantOrderDetailsAction.Request dr = new RestaurantOrderDetailsAction.Request();
        dr.orderNumber = 'VR261111-AB12CD';
        dr.customerPhone = '9876543210';
        RestaurantOrderDetails d = RestaurantOrderDetailsAction.getOrderDetails(new List<RestaurantOrderDetailsAction.Request>{ dr })[0].details;
        System.assertEquals(true, d.success);
        System.assertEquals(2, d.items[0].quantity);

        RestaurantOrderStatusAction.Request sr = new RestaurantOrderStatusAction.Request();
        sr.orderNumber = 'VR261111-AB12CD';
        sr.customerPhone = '9876543210';
        RestaurantOrderStatusResponse s = RestaurantOrderStatusAction.getOrderStatus(new List<RestaurantOrderStatusAction.Request>{ sr })[0].status;
        System.assertEquals('PREPARING', s.status);

        RestaurantApiMock.stub('POST /agent/orders/details', 404, '{"statusCode":404,"message":"Order not found"}');
        RestaurantApiMock.stub('POST /agent/orders/status', 404, '{"statusCode":404,"message":"Order not found"}');
        RestaurantOrderDetails nd = RestaurantOrderDetailsAction.getOrderDetails(new List<RestaurantOrderDetailsAction.Request>{ dr })[0].details;
        System.assertEquals(false, nd.success);
        System.assert(nd.message.contains('No order was found'));
        RestaurantOrderStatusResponse ns = RestaurantOrderStatusAction.getOrderStatus(new List<RestaurantOrderStatusAction.Request>{ sr })[0].status;
        System.assertEquals(false, ns.success);
        System.assertEquals(null, ns.status, 'no invented status');
    }

    // ------------------------------------------------------------------ cancellation

    @IsTest
    static void cancellationNeedsExplicitConfirmation() {
        RestaurantApiMock.install();
        RestaurantOrderCancellationAction.Request r = new RestaurantOrderCancellationAction.Request();
        r.cancellation = new RestaurantCancellationRequest();
        r.cancellation.orderNumber = 'VR261111-AB12CD';
        r.cancellation.customerPhone = '9876543210';
        r.cancellation.confirmed = false;
        RestaurantCancellationResponse c = RestaurantOrderCancellationAction.cancelRestaurantOrder(new List<RestaurantOrderCancellationAction.Request>{ r })[0].result;
        System.assertEquals(false, c.cancelled);
        System.assertEquals('CONFIRMATION_REQUIRED', c.code);
        System.assertEquals(0, RestaurantApiMock.callCount, 'no cancel call without confirmation');

        r.cancellation = null;
        System.assertEquals(false, RestaurantOrderCancellationAction.cancelRestaurantOrder(new List<RestaurantOrderCancellationAction.Request>{ r })[0].result.cancelled);
    }

    @IsTest
    static void cancellationSuccessAndRefusals() {
        RestaurantApiMock.install();
        RestaurantOrderCancellationAction.Request r = new RestaurantOrderCancellationAction.Request();
        r.cancellation = new RestaurantCancellationRequest();
        r.cancellation.orderNumber = 'VR261111-AB12CD';
        r.cancellation.customerPhone = '9876543210';
        r.cancellation.reason = 'changed my mind';
        r.cancellation.confirmed = true;

        RestaurantCancellationResponse ok = RestaurantOrderCancellationAction.cancelRestaurantOrder(new List<RestaurantOrderCancellationAction.Request>{ r })[0].result;
        System.assertEquals(true, ok.cancelled);
        System.assertEquals('CANCELLED', ok.status);

        // The backend refuses (kitchen already started): the action must report cancelled=false.
        RestaurantApiMock.stub('POST /agent/orders/cancel', 200, '{"cancelled":false,"code":"KITCHEN_STARTED","message":"The kitchen has already started preparing this order.","orderNumber":"VR261111-AB12CD","status":"PREPARING","paymentStatus":"PAID"}');
        RestaurantCancellationResponse refused = RestaurantOrderCancellationAction.cancelRestaurantOrder(new List<RestaurantOrderCancellationAction.Request>{ r })[0].result;
        System.assertEquals(true, refused.success, 'the call worked');
        System.assertEquals(false, refused.cancelled, 'but the order was NOT cancelled');
        System.assertEquals('KITCHEN_STARTED', refused.code);
        System.assertEquals('PREPARING', refused.status);

        // API errors never turn into a cancellation.
        RestaurantApiMock.stub('POST /agent/orders/cancel', 404, '{"statusCode":404,"message":"Order not found"}');
        RestaurantCancellationResponse missing = RestaurantOrderCancellationAction.cancelRestaurantOrder(new List<RestaurantOrderCancellationAction.Request>{ r })[0].result;
        System.assertEquals(false, missing.success);
        System.assertEquals(false, missing.cancelled);
        System.assert(missing.message.contains('No order was found'));
    }

    // ------------------------------------------------------------------ reservations

    @IsTest
    static void reservationActions() {
        RestaurantApiMock.install();
        RestaurantReservationAction.Request cr = new RestaurantReservationAction.Request();
        cr.customerConfirmed = false;
        cr.reservation = new RestaurantReservationRequest();
        System.assertEquals('CONFIRMATION_REQUIRED', RestaurantReservationAction.createReservation(new List<RestaurantReservationAction.Request>{ cr })[0].reservation.errorCode);
        System.assertEquals(0, RestaurantApiMock.callCount);

        cr.customerConfirmed = true;
        cr.reservation.customerName = 'Asha';
        cr.reservation.customerPhone = '9876543210';
        cr.reservation.partySize = 4;
        cr.reservation.startsAt = '2026-12-01T19:30:00+05:30';
        RestaurantReservationResponse created = RestaurantReservationAction.createReservation(new List<RestaurantReservationAction.Request>{ cr })[0].reservation;
        System.assertEquals(true, created.success);
        System.assertEquals('REQUESTED', created.status);

        cr.reservation.partySize = 0;
        System.assertEquals('VALIDATION_ERROR', RestaurantReservationAction.createReservation(new List<RestaurantReservationAction.Request>{ cr })[0].reservation.errorCode);

        RestaurantReservationDetailsAction.Request dr = new RestaurantReservationDetailsAction.Request();
        dr.reservationId = '11111111-1111-1111-1111-111111111111';
        dr.customerPhone = '9876543210';
        System.assertEquals('REQUESTED', RestaurantReservationDetailsAction.getReservation(new List<RestaurantReservationDetailsAction.Request>{ dr })[0].reservation.status);
        RestaurantApiMock.stub('POST /agent/reservations/details', 404, '{"statusCode":404,"message":"Reservation not found"}');
        RestaurantReservationResponse nf = RestaurantReservationDetailsAction.getReservation(new List<RestaurantReservationDetailsAction.Request>{ dr })[0].reservation;
        System.assertEquals(false, nf.success);
        System.assert(nf.message.contains('No reservation was found'));

        RestaurantReservationCancellationAction.Request xr = new RestaurantReservationCancellationAction.Request();
        xr.reservationId = '11111111-1111-1111-1111-111111111111';
        xr.customerPhone = '9876543210';
        xr.customerConfirmed = false;
        RestaurantReservationResponse notConfirmed = RestaurantReservationCancellationAction.cancelReservation(new List<RestaurantReservationCancellationAction.Request>{ xr })[0].reservation;
        System.assertEquals(false, notConfirmed.cancelled);
        xr.customerConfirmed = true;
        RestaurantReservationResponse cancelled = RestaurantReservationCancellationAction.cancelReservation(new List<RestaurantReservationCancellationAction.Request>{ xr })[0].reservation;
        System.assertEquals(true, cancelled.cancelled);
        RestaurantApiMock.stub('POST /agent/reservations/cancel', 404, '{"statusCode":404,"message":"Reservation not found"}');
        System.assertEquals(false, RestaurantReservationCancellationAction.cancelReservation(new List<RestaurantReservationCancellationAction.Request>{ xr })[0].reservation.success);
    }

    // ------------------------------------------------------------------ bulk safety

    @IsTest
    static void multipleRequestsInOneInvocationAreAllAnswered() {
        RestaurantApiMock.install();
        List<RestaurantMenuAction.Request> reqs = new List<RestaurantMenuAction.Request>();
        for (Integer i = 0; i < 5; i++) {
            reqs.add(new RestaurantMenuAction.Request());
        }
        List<RestaurantMenuAction.Response> out = RestaurantMenuAction.getRestaurantMenu(reqs);
        System.assertEquals(5, out.size());
        System.assertEquals(5, RestaurantApiMock.callCount);
    }
}
