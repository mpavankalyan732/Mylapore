/**
 * HTTP callout mock for the restaurant API. TEST ONLY: never used by production code.
 * Default fixtures mirror the real /api/v1/agent/* response shapes. Use stub() to change one endpoint.
 */
@IsTest
public class RestaurantApiMock implements HttpCalloutMock {
    public static HttpRequest lastRequest;
    public static Integer callCount = 0;
    public static Boolean throwCalloutException = false;
    private static Map<String, Response> overrides = new Map<String, Response>();

    private class Response {
        Integer status;
        String body;
    }

    public static final String ITEM =
        '{"id":"item-1","slug":"masala-dosa","name":"Masala Dosa","description":"Crisp crepe","nameTranslations":{"en":"Masala Dosa"},' +
        '"category":{"id":"cat-1","slug":"idli-dosa","name":"Idli & Dosa"},"subcategory":null,"price":90,"pricePaise":9000,"currency":"INR",' +
        '"isAvailable":true,"isBestseller":true,"imageUrl":"https://example.com/dosa.jpg","dietary":{"vegetarian":true,"vegan":true,"jain":false},' +
        '"spiceLevel":"Mild","cuisine":"SOUTH_INDIAN","tags":["idli-dosa"],"ingredients":"Rice, urad dal","allergens":["Milk"],"nutrition":null,' +
        '"customizations":[{"id":"c1","name":"Spice","type":"single","required":false,"options":[{"id":"o1","name":"Mild","priceDelta":0}]}],"allowsNotes":true}';

    public static final String CATEGORY =
        '{"id":"cat-1","slug":"idli-dosa","name":"Idli & Dosa","description":null,"imageUrl":"https://example.com/c.jpg","itemCount":1,' +
        '"availableItemCount":1,"subcategories":[{"id":"sub-1","slug":"dosa","name":"Dosa","description":"All dosas"}]';

    public static final String MENU =
        '{"currency":"INR","totalItems":1,"warnings":["note"],"categories":[' + CATEGORY + ',"items":[' + ITEM + ']}]}';

    public static final String CATEGORIES = '{"categories":[' + CATEGORY + '}],"warnings":[]}';

    public static final String ITEMS = '{"currency":"INR","count":1,"items":[' + ITEM + '],"warnings":[]}';

    public static final String CONFIG =
        '{"currency":"INR","taxPercent":5,"deliveryFee":30,"deliveryFeePaise":3000,"servicePincodes":["517501"],' +
        '"fulfilmentOptions":["DINE_IN","TAKEAWAY","DELIVERY"],"paymentMethods":["ONLINE","COD"],"cancellationPolicy":"Until the kitchen starts."}';

    public static final String ORDER =
        '{"orderNumber":"VR261111-AB12CD","status":"CONFIRMED","statusMessage":"Order confirmed and waiting for the kitchen.",' +
        '"paymentStatus":"COD_PENDING","paymentMethod":"COD","fulfilment":"TAKEAWAY","createdAt":"2026-11-11T10:00:00.000Z","customerName":"Asha",' +
        '"deliveryPincode":null,"notes":null,"currency":"INR","items":[{"menuItemId":"item-1","name":"Masala Dosa","quantity":2,"notes":"less spicy",' +
        '"unitPrice":90,"unitPricePaise":9000,"lineTotal":180,"lineTotalPaise":18000}],"subtotal":180,"tax":9,"deliveryFee":0,"total":189,' +
        '"cancellable":true,"cancellableReason":"The kitchen has not started preparing this order.","replay":false,"checkoutUrl":null,' +
        '"nextAction":"NONE","trackingUrl":"https://example.com/order/VR261111-AB12CD?t=abc","confirmation":"Order VR261111-AB12CD is confirmed and sent to the kitchen."}';

    public static final String ORDER_ONLINE =
        ORDER.replace('"paymentMethod":"COD"', '"paymentMethod":"ONLINE"').replace('"status":"CONFIRMED"', '"status":"PENDING_PAYMENT"')
            .replace('"checkoutUrl":null', '"checkoutUrl":"https://pay.example.com/x"').replace('"nextAction":"NONE"', '"nextAction":"OPEN_CHECKOUT"');

    public static final String STATUS =
        '{"orderNumber":"VR261111-AB12CD","status":"PREPARING","statusMessage":"The kitchen is preparing your order.","paymentStatus":"PAID",' +
        '"fulfilment":"TAKEAWAY","total":189,"totalPaise":18900,"currency":"INR","cancellable":false,"cancellableReason":"The kitchen has already started preparing this order.","checkoutUrl":null}';

    public static final String CANCELLED =
        '{"cancelled":true,"code":"CANCELLED","message":"Order cancelled.","refundRequired":false,"orderNumber":"VR261111-AB12CD",' +
        '"status":"CANCELLED","statusMessage":"This order was cancelled.","paymentStatus":"COD_PENDING","total":189,"currency":"INR"}';

    public static final String RESERVATION =
        '{"reservationId":"11111111-1111-1111-1111-111111111111","status":"REQUESTED","statusMessage":"Reservation request received.",' +
        '"partySize":4,"startsAt":"2026-12-01T14:00:00.000Z","notes":"Window","customerName":"Asha","createdAt":"2026-11-11T10:00:00.000Z"}';

    public static final String RESERVATION_CANCELLED =
        '{"cancelled":true,"code":"CANCELLED","message":"Reservation cancelled.","reservationId":"11111111-1111-1111-1111-111111111111",' +
        '"status":"CANCELLED","statusMessage":"This reservation was cancelled.","partySize":4,"startsAt":"2026-12-01T14:00:00.000Z","notes":"Window","customerName":"Asha"}';

    public static void reset() {
        lastRequest = null;
        callCount = 0;
        throwCalloutException = false;
        overrides = new Map<String, Response>();
    }

    /** @param methodAndPath e.g. 'POST /agent/orders/cancel' (matched as "method equals" and "path starts with") */
    public static void stub(String methodAndPath, Integer status, String body) {
        Response r = new Response();
        r.status = status;
        r.body = body;
        overrides.put(methodAndPath, r);
    }

    public HttpResponse respond(HttpRequest req) {
        callCount++;
        lastRequest = req;
        if (throwCalloutException) {
            throw new CalloutException('Read timed out');
        }
        String path = req.getEndpoint().substringAfter('callout:Restaurant_API');
        // Several stubs can match one request (e.g. /agent/orders and /agent/orders/details): the most specific wins.
        String best;
        for (String key : overrides.keySet()) {
            if (key.substringBefore(' ') == req.getMethod() && path.startsWith(key.substringAfter(' '))) {
                if (best == null || key.length() > best.length()) {
                    best = key;
                }
            }
        }
        if (best != null) {
            return build(overrides.get(best).status, overrides.get(best).body);
        }
        return build(200, fixtureFor(req.getMethod(), path));
    }

    private static String fixtureFor(String method, String path) {
        if (method == 'GET' && path.startsWith('/agent/config')) {
            return CONFIG;
        }
        if (method == 'GET' && path.startsWith('/agent/categories')) {
            return CATEGORIES;
        }
        if (method == 'GET' && path.startsWith('/agent/items/')) {
            return ITEM;
        }
        if (method == 'GET' && path.startsWith('/agent/items')) {
            return ITEMS;
        }
        if (method == 'GET' && path.startsWith('/agent/menu')) {
            return MENU;
        }
        if (method == 'POST' && path.startsWith('/agent/orders/details')) {
            return ORDER;
        }
        if (method == 'POST' && path.startsWith('/agent/orders/status')) {
            return STATUS;
        }
        if (method == 'POST' && path.startsWith('/agent/orders/cancel')) {
            return CANCELLED;
        }
        if (method == 'POST' && path.startsWith('/agent/orders')) {
            return ORDER;
        }
        if (method == 'POST' && path.startsWith('/agent/reservations/details')) {
            return RESERVATION;
        }
        if (method == 'POST' && path.startsWith('/agent/reservations/cancel')) {
            return RESERVATION_CANCELLED;
        }
        if (method == 'POST' && path.startsWith('/agent/reservations')) {
            return RESERVATION;
        }
        return '{}';
    }

    private static HttpResponse build(Integer status, String body) {
        HttpResponse res = new HttpResponse();
        res.setHeader('Content-Type', 'application/json');
        res.setStatusCode(status);
        res.setBody(body);
        return res;
    }

    public static void install() {
        reset();
        Test.setMock(HttpCalloutMock.class, new RestaurantApiMock());
    }
}
