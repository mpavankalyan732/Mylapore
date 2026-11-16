/**
 * Converts the restaurant API's JSON (parsed with JSON.deserializeUntyped) into the Apex-defined types.
 * Mapping field by field (instead of JSON.deserialize) keeps us tolerant of new fields the API may add.
 */
public with sharing class RestaurantApiMapper {
    // ------------------------------------------------------------------ safe readers

    public static String str(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        return v == null ? null : String.valueOf(v);
    }

    public static Decimal dec(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        if (v == null) {
            return null;
        }
        try {
            return Decimal.valueOf(String.valueOf(v));
        } catch (Exception e) {
            return null;
        }
    }

    public static Integer intv(Map<String, Object> m, String key) {
        Decimal d = dec(m, key);
        return d == null ? null : d.intValue();
    }

    public static Boolean bool(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        return v instanceof Boolean ? (Boolean) v : false;
    }

    public static Map<String, Object> obj(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        return v instanceof Map<String, Object> ? (Map<String, Object>) v : new Map<String, Object>();
    }

    public static List<Map<String, Object>> objs(Map<String, Object> m, String key) {
        List<Map<String, Object>> out = new List<Map<String, Object>>();
        Object v = m == null ? null : m.get(key);
        if (v instanceof List<Object>) {
            for (Object o : (List<Object>) v) {
                if (o instanceof Map<String, Object>) {
                    out.add((Map<String, Object>) o);
                }
            }
        }
        return out;
    }

    public static List<String> strings(Map<String, Object> m, String key) {
        List<String> out = new List<String>();
        Object v = m == null ? null : m.get(key);
        if (v instanceof List<Object>) {
            for (Object o : (List<Object>) v) {
                if (o != null) {
                    out.add(String.valueOf(o));
                }
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ menu

    public static RestaurantCustomizationOption customizationOption(Map<String, Object> m) {
        RestaurantCustomizationOption o = new RestaurantCustomizationOption();
        o.id = str(m, 'id');
        o.name = str(m, 'name');
        o.priceDelta = dec(m, 'priceDelta');
        return o;
    }

    public static RestaurantCustomization customization(Map<String, Object> m) {
        RestaurantCustomization c = new RestaurantCustomization();
        c.id = str(m, 'id');
        c.name = str(m, 'name');
        c.customizationType = str(m, 'type');
        c.isRequired = bool(m, 'required');
        for (Map<String, Object> o : objs(m, 'options')) {
            c.options.add(customizationOption(o));
        }
        return c;
    }

    public static RestaurantSubcategory subcategory(Map<String, Object> m) {
        RestaurantSubcategory s = new RestaurantSubcategory();
        s.id = str(m, 'id');
        s.slug = str(m, 'slug');
        s.name = str(m, 'name');
        s.description = str(m, 'description');
        return s;
    }

    public static RestaurantMenuItem menuItem(Map<String, Object> m) {
        RestaurantMenuItem i = new RestaurantMenuItem();
        Map<String, Object> cat = obj(m, 'category');
        Map<String, Object> diet = obj(m, 'dietary');
        i.id = str(m, 'id');
        i.slug = str(m, 'slug');
        i.name = str(m, 'name');
        i.description = str(m, 'description');
        i.categoryId = str(cat, 'id');
        i.categoryName = str(cat, 'name');
        i.subcategory = str(m, 'subcategory');
        i.price = dec(m, 'price');
        i.pricePaise = intv(m, 'pricePaise');
        i.currencyCode = str(m, 'currency');
        i.isAvailable = bool(m, 'isAvailable');
        i.isBestseller = bool(m, 'isBestseller');
        i.imageUrl = str(m, 'imageUrl');
        i.isVegetarian = bool(diet, 'vegetarian');
        i.isVegan = bool(diet, 'vegan');
        i.isJain = bool(diet, 'jain');
        i.spiceLevel = str(m, 'spiceLevel');
        i.cuisine = str(m, 'cuisine');
        i.tags = strings(m, 'tags');
        i.ingredients = str(m, 'ingredients');
        i.allergens = strings(m, 'allergens');
        i.allowsNotes = bool(m, 'allowsNotes');
        for (Map<String, Object> c : objs(m, 'customizations')) {
            i.customizations.add(customization(c));
        }
        return i;
    }

    public static RestaurantCategory category(Map<String, Object> m) {
        RestaurantCategory c = new RestaurantCategory();
        c.id = str(m, 'id');
        c.slug = str(m, 'slug');
        c.name = str(m, 'name');
        c.description = str(m, 'description');
        c.imageUrl = str(m, 'imageUrl');
        c.itemCount = intv(m, 'itemCount');
        c.availableItemCount = intv(m, 'availableItemCount');
        for (Map<String, Object> s : objs(m, 'subcategories')) {
            c.subcategories.add(subcategory(s));
        }
        for (Map<String, Object> i : objs(m, 'items')) {
            c.items.add(menuItem(i));
        }
        return c;
    }

    /** Maps /agent/menu, /agent/categories and /agent/items responses. */
    public static RestaurantMenuResponse menuResponse(Map<String, Object> m) {
        RestaurantMenuResponse r = new RestaurantMenuResponse();
        r.success = true;
        r.currencyCode = str(m, 'currency');
        r.totalItems = intv(m, 'totalItems');
        for (Map<String, Object> c : objs(m, 'categories')) {
            r.categories.add(category(c));
        }
        for (Map<String, Object> i : objs(m, 'items')) {
            r.items.add(menuItem(i));
        }
        if (r.totalItems == null) {
            r.totalItems = intv(m, 'count');
        }
        if (r.totalItems == null) {
            r.totalItems = r.items.size();
        }
        r.warnings = strings(m, 'warnings');
        return r;
    }

    public static RestaurantItemDetails itemDetails(Map<String, Object> m) {
        RestaurantItemDetails d = new RestaurantItemDetails();
        d.success = true;
        d.item = menuItem(m);
        Map<String, Object> n = obj(m, 'nutrition');
        d.nutritionAvailable = !n.isEmpty();
        List<String> parts = new List<String>();
        for (String k : n.keySet()) {
            parts.add(k + ': ' + String.valueOf(n.get(k)));
        }
        d.nutritionSummary = parts.isEmpty() ? null : String.join(parts, ', ');
        d.notice = 'Ingredient and allergen details may still be confirmed by the kitchen. Always check with the restaurant if you have an allergy.';
        return d;
    }

    public static RestaurantConfigResponse config(Map<String, Object> m) {
        RestaurantConfigResponse c = new RestaurantConfigResponse();
        c.success = true;
        c.currencyCode = str(m, 'currency');
        c.taxPercent = dec(m, 'taxPercent');
        c.deliveryFee = dec(m, 'deliveryFee');
        c.servicePincodes = strings(m, 'servicePincodes');
        c.fulfilmentOptions = strings(m, 'fulfilmentOptions');
        c.paymentMethods = strings(m, 'paymentMethods');
        c.cancellationPolicy = str(m, 'cancellationPolicy');
        return c;
    }

    // ------------------------------------------------------------------ orders

    public static List<RestaurantOrderItem> orderItems(Map<String, Object> m) {
        List<RestaurantOrderItem> out = new List<RestaurantOrderItem>();
        for (Map<String, Object> o : objs(m, 'items')) {
            RestaurantOrderItem i = new RestaurantOrderItem();
            i.menuItemId = str(o, 'menuItemId');
            i.name = str(o, 'name');
            i.quantity = intv(o, 'quantity');
            i.notes = str(o, 'notes');
            i.unitPrice = dec(o, 'unitPrice');
            i.lineTotal = dec(o, 'lineTotal');
            out.add(i);
        }
        return out;
    }

    public static RestaurantOrderResponse orderResponse(Map<String, Object> m) {
        RestaurantOrderResponse r = new RestaurantOrderResponse();
        r.success = true;
        r.orderNumber = str(m, 'orderNumber');
        r.status = str(m, 'status');
        r.statusMessage = str(m, 'statusMessage');
        r.paymentStatus = str(m, 'paymentStatus');
        r.paymentMethod = str(m, 'paymentMethod');
        r.fulfilment = str(m, 'fulfilment');
        r.currencyCode = str(m, 'currency');
        r.subtotal = dec(m, 'subtotal');
        r.tax = dec(m, 'tax');
        r.deliveryFee = dec(m, 'deliveryFee');
        r.total = dec(m, 'total');
        r.items = orderItems(m);
        r.checkoutUrl = str(m, 'checkoutUrl');
        r.trackingUrl = str(m, 'trackingUrl');
        r.nextAction = str(m, 'nextAction');
        r.confirmation = str(m, 'confirmation');
        r.replay = bool(m, 'replay');
        return r;
    }

    public static RestaurantOrderDetails orderDetails(Map<String, Object> m) {
        RestaurantOrderDetails d = new RestaurantOrderDetails();
        d.success = true;
        d.orderNumber = str(m, 'orderNumber');
        d.status = str(m, 'status');
        d.statusMessage = str(m, 'statusMessage');
        d.paymentStatus = str(m, 'paymentStatus');
        d.paymentMethod = str(m, 'paymentMethod');
        d.fulfilment = str(m, 'fulfilment');
        d.createdAt = str(m, 'createdAt');
        d.customerName = str(m, 'customerName');
        d.deliveryPincode = str(m, 'deliveryPincode');
        d.notes = str(m, 'notes');
        d.currencyCode = str(m, 'currency');
        d.items = orderItems(m);
        d.subtotal = dec(m, 'subtotal');
        d.tax = dec(m, 'tax');
        d.deliveryFee = dec(m, 'deliveryFee');
        d.total = dec(m, 'total');
        d.cancellable = bool(m, 'cancellable');
        d.cancellableReason = str(m, 'cancellableReason');
        d.checkoutUrl = str(m, 'checkoutUrl');
        return d;
    }

    public static RestaurantOrderStatusResponse orderStatus(Map<String, Object> m) {
        RestaurantOrderStatusResponse s = new RestaurantOrderStatusResponse();
        s.success = true;
        s.orderNumber = str(m, 'orderNumber');
        s.status = str(m, 'status');
        s.statusMessage = str(m, 'statusMessage');
        s.paymentStatus = str(m, 'paymentStatus');
        s.fulfilment = str(m, 'fulfilment');
        s.currencyCode = str(m, 'currency');
        s.total = dec(m, 'total');
        s.cancellable = bool(m, 'cancellable');
        s.cancellableReason = str(m, 'cancellableReason');
        s.checkoutUrl = str(m, 'checkoutUrl');
        return s;
    }

    public static RestaurantCancellationResponse cancellation(Map<String, Object> m) {
        RestaurantCancellationResponse c = new RestaurantCancellationResponse();
        c.success = true;
        c.cancelled = bool(m, 'cancelled');
        c.code = str(m, 'code');
        c.message = str(m, 'message');
        c.refundRequired = bool(m, 'refundRequired');
        c.orderNumber = str(m, 'orderNumber');
        c.status = str(m, 'status');
        c.statusMessage = str(m, 'statusMessage');
        c.paymentStatus = str(m, 'paymentStatus');
        return c;
    }

    // ------------------------------------------------------------------ reservations

    public static RestaurantReservationResponse reservation(Map<String, Object> m) {
        RestaurantReservationResponse r = new RestaurantReservationResponse();
        r.success = true;
        r.reservationId = str(m, 'reservationId');
        r.status = str(m, 'status');
        r.statusMessage = str(m, 'statusMessage');
        r.partySize = intv(m, 'partySize');
        r.startsAt = str(m, 'startsAt');
        r.notes = str(m, 'notes');
        r.customerName = str(m, 'customerName');
        r.cancelled = m != null && m.containsKey('cancelled') ? bool(m, 'cancelled') : null;
        r.code = str(m, 'code');
        r.message = str(m, 'message');
        return r;
    }
}
