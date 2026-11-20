@IsTest
private class RestaurantApiServiceTest {
    private static RestaurantOrderRequest validOrder() {
        RestaurantOrderRequest r = new RestaurantOrderRequest();
        r.customerName = 'Asha';
        r.customerPhone = '+91 98765-43210';
        r.fulfilment = 'takeaway';
        r.paymentMethod = 'cod';
        RestaurantOrderItem i = new RestaurantOrderItem();
        i.menuItemId = 'item-1';
        i.quantity = 2;
        i.notes = 'less spicy';
        r.items = new List<RestaurantOrderItem>{ i };
        return r;
    }

    // ------------------------------------------------------------------ menu

    @IsTest
    static void getMenuMapsCategoriesItemsAndWarnings() {
        RestaurantApiMock.install();
        Test.startTest();
        RestaurantMenuResponse m = RestaurantApiService.getMenu(null, null, null, null);
        Test.stopTest();
        System.assertEquals(true, m.success);
        System.assertEquals(1, m.categories.size());
        RestaurantCategory c = m.categories[0];
        System.assertEquals('Idli & Dosa', c.name);
        System.assertEquals(1, c.subcategories.size());
        System.assertEquals('Dosa', c.subcategories[0].name);
        RestaurantMenuItem item = c.items[0];
        System.assertEquals('Masala Dosa', item.name);
        System.assertEquals(90.0, item.price);
        System.assertEquals(9000, item.pricePaise);
        System.assertEquals(true, item.isAvailable);
        System.assertEquals(true, item.isVegetarian);
        System.assertEquals(true, item.isVegan);
        System.assertEquals(false, item.isJain);
        System.assertEquals('Milk', item.allergens[0]);
        System.assertEquals('Idli & Dosa', item.categoryName);
        System.assertEquals(1, item.customizations.size());
        System.assertEquals('Mild', item.customizations[0].options[0].name);
        System.assertEquals('note', m.warnings[0]);
        System.assertEquals('GET', RestaurantApiMock.lastRequest.getMethod());
        System.assert(RestaurantApiMock.lastRequest.getEndpoint().startsWith('callout:Restaurant_API/agent/menu'), 'must use the Named Credential');
    }

    @IsTest
    static void getMenuEncodesFilters() {
        RestaurantApiMock.install();
        RestaurantApiService.getMenu('idli-dosa', 'dosa', 'masala dosa', true);
        String url = RestaurantApiMock.lastRequest.getEndpoint();
        System.assert(url.contains('category=idli-dosa'), url);
        System.assert(url.contains('subcategory=dosa'), url);
        System.assert(url.contains('q=masala+dosa'), url);
        System.assert(url.contains('includeUnavailable=true'), url);
    }

    @IsTest
    static void getCategoriesItemsConfigAndDetails() {
        RestaurantApiMock.install();
        System.assertEquals('Idli & Dosa', RestaurantApiService.getCategories().categories[0].name);
        RestaurantMenuResponse items = RestaurantApiService.getItems('idli-dosa', null, 'dosa', false);
        System.assertEquals(1, items.items.size());
        System.assertEquals(1, items.totalItems);
        RestaurantConfigResponse cfg = RestaurantApiService.getConfig();
        System.assertEquals(5.0, cfg.taxPercent);
        System.assertEquals(30.0, cfg.deliveryFee);
        System.assertEquals('517501', cfg.servicePincodes[0]);
        System.assert(cfg.paymentMethods.contains('COD'));
        RestaurantItemDetails d = RestaurantApiService.getItemDetails('masala-dosa');
        System.assertEquals('Masala Dosa', d.item.name);
        System.assertEquals(false, d.nutritionAvailable);
        System.assertNotEquals(null, d.notice);
        System.assert(RestaurantApiMock.lastRequest.getEndpoint().endsWith('/agent/items/masala-dosa'));
    }

    @IsTest
    static void itemDetailsNeedsAReference() {
        RestaurantApiMock.install();
        try {
            RestaurantApiService.getItemDetails(' ');
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
        }
        System.assertEquals(0, RestaurantApiMock.callCount, 'no callout for invalid input');
    }

    @IsTest
    static void itemDetailsSummarisesNutritionWhenPresent() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('GET /agent/items/', 200, RestaurantApiMock.ITEM.replace('"nutrition":null', '"nutrition":{"calories":210,"servingSize":"1 piece"}'));
        RestaurantItemDetails d = RestaurantApiService.getItemDetails('masala-dosa');
        System.assertEquals(true, d.nutritionAvailable);
        System.assert(d.nutritionSummary.contains('calories: 210'));
    }

    // ------------------------------------------------------------------ orders

    @IsTest
    static void createOrderSendsOnlyWhatTheBackendNeedsAndMapsTheAnswer() {
        RestaurantApiMock.install();
        RestaurantOrderResponse o = RestaurantApiService.createOrder(validOrder());
        System.assertEquals(true, o.success);
        System.assertEquals('VR261111-AB12CD', o.orderNumber);
        System.assertEquals(189.0, o.total);
        System.assertEquals(9.0, o.tax);
        System.assertEquals('NONE', o.nextAction);
        System.assertEquals(1, o.items.size());
        System.assertEquals('less spicy', o.items[0].notes);
        System.assertEquals(180.0, o.items[0].lineTotal);

        HttpRequest req = RestaurantApiMock.lastRequest;
        System.assertEquals('POST', req.getMethod());
        System.assertEquals('application/json', req.getHeader('Content-Type'));
        System.assert(req.getHeader('Idempotency-Key').startsWith('sf-'));
        Map<String, Object> sent = (Map<String, Object>) JSON.deserializeUntyped(req.getBody());
        System.assertEquals('TAKEAWAY', sent.get('fulfilment'));
        System.assertEquals('COD', sent.get('paymentMethod'));
        Map<String, Object> customer = (Map<String, Object>) sent.get('customer');
        System.assertEquals('9876543210', customer.get('phone'), 'phone normalised to 10 digits');
        System.assert(!req.getBody().contains('price'), 'prices are never sent: the backend calculates them');
        System.assert(!sent.containsKey('address'), 'no address for takeaway');
    }

    @IsTest
    static void createOrderDeliverySendsAddress() {
        RestaurantApiMock.install();
        RestaurantOrderRequest r = validOrder();
        r.fulfilment = 'Delivery';
        r.deliveryAddressLine = '12 Temple Street';
        r.deliveryPincode = '517501';
        r.deliveryLandmark = 'Near the bus stop';
        r.notes = 'Ring the bell';
        r.customerEmail = 'a@example.com';
        RestaurantApiService.createOrder(r);
        Map<String, Object> sent = (Map<String, Object>) JSON.deserializeUntyped(RestaurantApiMock.lastRequest.getBody());
        Map<String, Object> address = (Map<String, Object>) sent.get('address');
        System.assertEquals('517501', address.get('pincode'));
        System.assertEquals('Near the bus stop', address.get('landmark'));
        System.assertEquals('Ring the bell', sent.get('notes'));
        System.assertEquals('a@example.com', ((Map<String, Object>) sent.get('customer')).get('email'));
    }

    @IsTest
    static void createOrderValidatesBeforeCallingTheApi() {
        RestaurantApiMock.install();
        RestaurantOrderRequest r = new RestaurantOrderRequest();
        r.fulfilment = 'delivery';
        r.paymentMethod = 'bitcoin';
        r.customerPhone = '123';
        RestaurantOrderItem bad = new RestaurantOrderItem();
        bad.menuItemId = 'x';
        bad.quantity = 0;
        r.items = new List<RestaurantOrderItem>{ bad };
        try {
            RestaurantApiService.createOrder(r);
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
            System.assert(e.getMessage().contains('Customer name'), e.getMessage());
            System.assert(e.getMessage().contains('mobile'), e.getMessage());
            System.assert(e.getMessage().contains('Quantity'), e.getMessage());
            System.assert(e.getMessage().contains('Payment method'), e.getMessage());
            System.assert(e.getMessage().contains('delivery address'), e.getMessage());
            System.assert(e.getMessage().contains('pincode'), e.getMessage());
        }
        System.assertEquals(0, RestaurantApiMock.callCount, 'no callout for an invalid order');
        System.assertEquals(1, RestaurantApiService.validateOrder(null).size());
    }

    @IsTest
    static void createOrderSurfacesUnavailableItems() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('POST /agent/orders', 409, '{"statusCode":409,"code":"ITEM_UNAVAILABLE","message":"Some items are no longer available","itemIds":["item-1"]}');
        try {
            RestaurantApiService.createOrder(validOrder());
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals(409, e.statusCode);
            System.assertEquals('ITEM_UNAVAILABLE', e.errorCode);
            System.assertEquals('item-1', RestaurantApiMapper.strings(e.details, 'itemIds')[0]);
        }
    }

    @IsTest
    static void errorsMapToSafeMessages() {
        RestaurantApiMock.install();
        RestaurantApiMock.stub('GET /agent/items/', 404, '{"statusCode":404,"message":"Menu item not found","error":"Not Found"}');
        try {
            RestaurantApiService.getItemDetails('nope');
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('NOT_FOUND', e.errorCode);
            System.assertEquals('Menu item not found', e.getMessage());
        }

        RestaurantApiMock.stub('GET /agent/menu', 401, '{"statusCode":401,"message":"Invalid API key"}');
        try {
            RestaurantApiService.getMenu(null, null, null, null);
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('UNAUTHORIZED', e.errorCode);
            System.assert(!e.getMessage().contains('API key'), 'authentication details must not be echoed');
        }

        RestaurantApiMock.stub('GET /agent/categories', 500, '<html>Bad gateway</html>');
        try {
            RestaurantApiService.getCategories();
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('SERVER_ERROR', e.errorCode);
            System.assert(e.getMessage().contains('try again'));
        }

        RestaurantApiMock.stub('GET /agent/config', 429, '{}');
        try {
            RestaurantApiService.getConfig();
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('RATE_LIMITED', e.errorCode);
        }

        RestaurantApiMock.stub('POST /agent/reservations', 400, '{"statusCode":400,"message":["partySize must not be greater than 60","startsAt must be a valid ISO 8601 date string"]}');
        RestaurantReservationRequest rr = new RestaurantReservationRequest();
        rr.customerName = 'Asha';
        rr.customerPhone = '9876543210';
        rr.partySize = 4;
        rr.startsAt = '2026-12-01T19:30:00+05:30';
        try {
            RestaurantApiService.createReservation(rr);
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
            System.assert(e.getMessage().contains('partySize'), e.getMessage());
            System.assert(e.getMessage().contains('; '), 'validation messages joined');
        }
    }

    @IsTest
    static void timeoutBecomesUnreachable() {
        RestaurantApiMock.install();
        RestaurantApiMock.throwCalloutException = true;
        try {
            RestaurantApiService.getMenu(null, null, null, null);
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals(0, e.statusCode);
            System.assertEquals('UNREACHABLE', e.errorCode);
            System.assertEquals('System.CalloutException', e.errorType);
            System.assert(!e.getMessage().contains('timed out'), 'internal details are not leaked');
        }
    }

    @IsTest
    static void orderDetailsStatusAndCancellation() {
        RestaurantApiMock.install();
        RestaurantOrderDetails d = RestaurantApiService.getOrderDetails(' VR261111-AB12CD ', '+91 98765 43210');
        System.assertEquals('VR261111-AB12CD', d.orderNumber);
        System.assertEquals(true, d.cancellable);
        System.assertEquals('Asha', d.customerName);
        Map<String, Object> sent = (Map<String, Object>) JSON.deserializeUntyped(RestaurantApiMock.lastRequest.getBody());
        System.assertEquals('VR261111-AB12CD', sent.get('orderNumber'));
        System.assertEquals('9876543210', sent.get('customerPhone'));

        RestaurantOrderStatusResponse s = RestaurantApiService.getOrderStatus('VR261111-AB12CD', '9876543210');
        System.assertEquals('PREPARING', s.status);
        System.assertEquals(false, s.cancellable);

        RestaurantCancellationResponse c = RestaurantApiService.cancelOrder('VR261111-AB12CD', '9876543210', 'changed my mind');
        System.assertEquals(true, c.cancelled);
        System.assertEquals('CANCELLED', c.code);
        System.assertEquals('changed my mind', ((Map<String, Object>) JSON.deserializeUntyped(RestaurantApiMock.lastRequest.getBody())).get('reason'));
    }

    @IsTest
    static void lookupsRejectBadInputWithoutCallingTheApi() {
        RestaurantApiMock.install();
        try {
            RestaurantApiService.getOrderStatus('', '9876543210');
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
        }
        try {
            RestaurantApiService.cancelOrder('VR1', 'not-a-phone', null);
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
        }
        try {
            RestaurantApiService.getReservation('', '9876543210');
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
        }
        try {
            RestaurantApiService.cancelReservation('11111111-1111-1111-1111-111111111111', '12');
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
        }
        System.assertEquals(0, RestaurantApiMock.callCount);
    }

    // ------------------------------------------------------------------ reservations

    @IsTest
    static void reservationsCreateGetCancel() {
        RestaurantApiMock.install();
        RestaurantReservationRequest rr = new RestaurantReservationRequest();
        rr.customerName = 'Asha';
        rr.customerPhone = '98765 43210';
        rr.partySize = 4;
        rr.startsAt = '2026-12-01T19:30:00+05:30';
        rr.notes = 'Window';
        RestaurantReservationResponse created = RestaurantApiService.createReservation(rr);
        System.assertEquals(true, created.success);
        System.assertEquals('REQUESTED', created.status);
        System.assertEquals(4, created.partySize);
        System.assertEquals(null, created.cancelled, 'create/get responses carry no cancellation flag');
        Map<String, Object> sent = (Map<String, Object>) JSON.deserializeUntyped(RestaurantApiMock.lastRequest.getBody());
        System.assertEquals(4, sent.get('partySize'));
        System.assertEquals('Window', sent.get('notes'));

        System.assertEquals('REQUESTED', RestaurantApiService.getReservation('11111111-1111-1111-1111-111111111111', '9876543210').status);
        RestaurantReservationResponse cancelled = RestaurantApiService.cancelReservation('11111111-1111-1111-1111-111111111111', '9876543210');
        System.assertEquals(true, cancelled.cancelled);
        System.assertEquals('CANCELLED', cancelled.status);
    }

    @IsTest
    static void reservationValidation() {
        RestaurantApiMock.install();
        try {
            RestaurantApiService.createReservation(new RestaurantReservationRequest());
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
            System.assert(e.getMessage().contains('Party size'));
        }
        try {
            RestaurantApiService.createReservation(null);
            System.assert(false, 'expected exception');
        } catch (RestaurantApiException e) {
            System.assertEquals('VALIDATION_ERROR', e.errorCode);
        }
        System.assertEquals(0, RestaurantApiMock.callCount);
    }

    // ------------------------------------------------------------------ helpers

    @IsTest
    static void idempotencyKeyIsStableForTheSameOrderAndDifferentOtherwise() {
        RestaurantApiService.clockMillisOverride = 1700000000000L; // frozen clock: no flakiness at window boundaries
        RestaurantOrderRequest a = validOrder();
        RestaurantOrderRequest b = validOrder();
        System.assertEquals(RestaurantApiService.idempotencyKey(a), RestaurantApiService.idempotencyKey(b));
        b.items[0].quantity = 3;
        System.assertNotEquals(RestaurantApiService.idempotencyKey(a), RestaurantApiService.idempotencyKey(b));
        a.idempotencyKey = ' my-own-key-123 ';
        System.assertEquals('my-own-key-123', RestaurantApiService.idempotencyKey(a), 'a caller supplied key wins');
        System.assert(RestaurantApiService.idempotencyKey(validOrder()).length() <= 100);
        String first = RestaurantApiService.idempotencyKey(validOrder());
        RestaurantApiService.clockMillisOverride = 1700000000000L + 600000L; // 10 minutes later = a new window
        System.assertNotEquals(first, RestaurantApiService.idempotencyKey(validOrder()), 'a deliberate re-order after the window is a new order');
    }

    @IsTest
    static void normalisers() {
        System.assertEquals('9876543210', RestaurantApiService.normalisePhone('+91 98765-43210'));
        System.assertEquals('9876543210', RestaurantApiService.normalisePhone('09876543210'));
        System.assertEquals(null, RestaurantApiService.normalisePhone(null));
        System.assertEquals(true, RestaurantApiService.isValidPhone('98765 43210'));
        System.assertEquals(false, RestaurantApiService.isValidPhone('5876543210'));
        System.assertEquals(false, RestaurantApiService.isValidPhone(null));
        System.assertEquals('DINE_IN', RestaurantApiService.normaliseEnum(' dine-in '));
        System.assertEquals('TAKEAWAY', RestaurantApiService.normaliseEnum('Takeaway'));
        System.assertEquals(null, RestaurantApiService.normaliseEnum(null));
    }

    @IsTest
    static void mapperIsTolerantOfMissingAndOddValues() {
        Map<String, Object> m = new Map<String, Object>{ 'n' => 'abc', 'b' => 'yes', 'o' => 'not a map' };
        System.assertEquals(null, RestaurantApiMapper.dec(m, 'n'), 'unparseable number gives null, not an exception');
        System.assertEquals(null, RestaurantApiMapper.dec(m, 'missing'));
        System.assertEquals(false, RestaurantApiMapper.bool(m, 'b'));
        System.assert(RestaurantApiMapper.obj(m, 'o').isEmpty());
        System.assert(RestaurantApiMapper.objs(m, 'missing').isEmpty());
        System.assert(RestaurantApiMapper.strings(null, 'x').isEmpty());
        System.assertEquals(null, RestaurantApiMapper.str(null, 'x'));
        System.assertEquals(null, RestaurantApiMapper.intv(null, 'x'));
        RestaurantMenuItem item = RestaurantApiMapper.menuItem(new Map<String, Object>());
        System.assertEquals(null, item.name);
        System.assertEquals(false, item.isAvailable);
        System.assert(item.customizations.isEmpty());
    }

    @IsTest
    static void exceptionDefaults() {
        System.assertEquals('CONFLICT', RestaurantApiException.defaultCode(409));
        System.assertEquals('UNPROCESSABLE', RestaurantApiException.defaultCode(422));
        System.assertEquals('HTTP_418', RestaurantApiException.defaultCode(418));
        RestaurantApiException e = RestaurantApiException.fromResponse(404, null);
        System.assertEquals('NOT_FOUND', e.errorCode);
        System.assert(RestaurantApiException.messageFrom(null, 418).contains('418'));
    }
}
