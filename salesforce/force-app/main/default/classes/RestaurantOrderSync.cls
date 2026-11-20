/**
 * Keeps the Salesforce copy of every order: Restaurant_Customer__c (one per phone), Restaurant_Order__c (one per
 * backend order number) and Restaurant_Order_Item__c (replaced on each save).
 * PostgreSQL stays the source of truth. A failure here is logged and NEVER breaks or hides the real order.
 * Call it AFTER all callouts of a transaction: DML before a callout is not allowed.
 */
public with sharing class RestaurantOrderSync {
    /** Saves a freshly placed order. Only runs when the backend created it (success and an order number). */
    public static void save(RestaurantOrderRequest req, RestaurantOrderResponse res) {
        if (res == null || res.success != true || String.isBlank(res.orderNumber)) {
            return;
        }
        try {
            Id customerId = upsertCustomer(req);
            Restaurant_Order__c rec = new Restaurant_Order__c(Order_Number__c = res.orderNumber);
            if (customerId != null) {
                rec.Customer__c = customerId;
            }
            rec.Customer_Name__c = req?.customerName;
            rec.Customer_Phone__c = phoneOf(req);
            rec.Fulfilment__c = firstNonBlank(res.fulfilment, req?.fulfilment);
            rec.Payment_Method__c = firstNonBlank(res.paymentMethod, req?.paymentMethod);
            rec.Payment_Status__c = res.paymentStatus;
            rec.Status__c = res.status;
            rec.Currency_Code__c = res.currencyCode;
            rec.Subtotal__c = res.subtotal;
            rec.Tax__c = res.tax;
            rec.Delivery_Fee__c = res.deliveryFee;
            rec.Total__c = res.total;
            rec.Items_Summary__c = summary(res.items);
            if (req != null && RestaurantApiService.normaliseEnum(req.fulfilment) == 'DELIVERY') {
                rec.Delivery_Address__c = req.deliveryAddressLine;
                rec.Delivery_Pincode__c = req.deliveryPincode;
            }
            new SystemOrderWriter().upsertOrder(rec);
            replaceItems(rec.Id, customerId, res.items, outcome(res.status, res.paymentStatus));
        } catch (Exception e) {
            warn(e);
        }
    }

    /** Refreshes status and payment status, e.g. after online payment is confirmed. */
    public static void updateStatus(RestaurantOrderStatusResponse s) {
        if (s == null || s.success != true || String.isBlank(s.orderNumber)) {
            return;
        }
        Restaurant_Order__c rec = new Restaurant_Order__c(Order_Number__c = s.orderNumber);
        rec.Status__c = s.status;
        rec.Payment_Status__c = s.paymentStatus;
        upsertQuietly(rec);
        setItemOutcome(s.orderNumber, outcome(s.status, s.paymentStatus));
    }

    /**
     * Called with the backend's answer to a payment-status check. PAID, FAILED and EXPIRED are copied; a still-pending
     * answer changes nothing. SUCCESS can only come from a PAID answer.
     */
    public static void updatePayment(RestaurantPaymentStatus p) {
        if (p == null || p.success != true || String.isBlank(p.orderNumber)) {
            return;
        }
        Restaurant_Order__c rec = new Restaurant_Order__c(Order_Number__c = p.orderNumber);
        if (p.status == 'PAID') {
            rec.Payment_Status__c = 'PAID';
            rec.Status__c = firstNonBlank(p.orderStatus, 'CONFIRMED');
            rec.Paid_At__c = parseTime(p.paidAt);
        } else if (p.status == 'FAILED' || p.status == 'EXPIRED') {
            rec.Payment_Status__c = p.status;
        } else {
            return;
        }
        upsertQuietly(rec);
        setItemOutcome(p.orderNumber, p.status == 'PAID' ? 'SUCCESS' : p.status);
    }

    /** Remembers which Razorpay link / QR the guest was sent to. */
    public static void markPaymentStarted(RestaurantPaymentStart s) {
        if (s == null || s.success != true || String.isBlank(s.orderNumber)) {
            return;
        }
        Restaurant_Order__c rec = new Restaurant_Order__c(Order_Number__c = s.orderNumber);
        rec.Payment_Status__c = 'PENDING';
        rec.Razorpay_Reference__c = s.method;
        upsertQuietly(rec);
    }

    /** Marks an order cancelled, only when the backend confirmed the cancellation. */
    public static void markCancelled(RestaurantCancellationResponse c) {
        if (c == null || c.cancelled != true || String.isBlank(c.orderNumber)) {
            return;
        }
        Restaurant_Order__c rec = new Restaurant_Order__c(Order_Number__c = c.orderNumber);
        rec.Status__c = String.isBlank(c.status) ? 'CANCELLED' : c.status;
        upsertQuietly(rec);
        setItemOutcome(c.orderNumber, 'CANCELLED');
    }

    private static Id upsertCustomer(RestaurantOrderRequest req) {
        return new SystemOrderWriter().upsertCustomer(req, phoneOf(req));
    }

    private static void replaceItems(Id orderId, Id customerId, List<RestaurantOrderItem> items, String itemOutcome) {
        new SystemOrderWriter().replaceItems(orderId, customerId, items, itemOutcome);
    }

    private static void setItemOutcome(String orderNumber, String itemOutcome) {
        try {
            new SystemOrderWriter().setItemOutcome(orderNumber, itemOutcome);
        } catch (Exception e) {
            warn(e);
        }
    }

    private static void upsertQuietly(Restaurant_Order__c rec) {
        try {
            new SystemOrderWriter().upsertOrder(rec);
        } catch (Exception e) {
            warn(e);
        }
    }

    /** Narrow system-mode writer for order records after a successful, validated API response. */
    private without sharing class SystemOrderWriter {
        Id upsertCustomer(RestaurantOrderRequest req, String phone) {
        if (String.isBlank(phone)) {
            return null;
        }
        Restaurant_Customer__c c = new Restaurant_Customer__c(Phone__c = phone, Last_Order_Date__c = Datetime.now());
        if (String.isNotBlank(req.customerName)) {
            c.Name = req.customerName.trim().left(80);
        }
        if (String.isNotBlank(req.customerEmail)) {
            c.Email__c = req.customerEmail.trim();
        }
        if (c.Name == null) {
            c.Name = phone;
        }
        Database.upsert(c, Restaurant_Customer__c.Phone__c, true);
        return c.Id;
        }

        void upsertOrder(Restaurant_Order__c rec) {
            Database.upsert(rec, Restaurant_Order__c.Order_Number__c, true);
        }

        void replaceItems(Id orderId, Id customerId, List<RestaurantOrderItem> items, String itemOutcome) {
        if (orderId == null) {
            return;
        }
        delete [SELECT Id FROM Restaurant_Order_Item__c WHERE Restaurant_Order__c = :orderId];
        List<Restaurant_Order_Item__c> rows = new List<Restaurant_Order_Item__c>();
        for (RestaurantOrderItem i : items == null ? new List<RestaurantOrderItem>() : items) {
            rows.add(new Restaurant_Order_Item__c(
                Restaurant_Order__c = orderId,
                Menu_Item_Id__c = i.menuItemId,
                Item_Name__c = i.name == null ? null : i.name.left(255),
                Quantity__c = i.quantity,
                Unit_Price__c = i.unitPrice,
                Line_Total__c = i.lineTotal,
                Notes__c = i.notes == null ? null : i.notes.left(255),
                Customer__c = customerId,
                Status__c = itemOutcome
            ));
        }
        insert rows;
        }

        void setItemOutcome(String orderNumber, String itemOutcome) {
            List<Restaurant_Order_Item__c> rows = new List<Restaurant_Order_Item__c>();
            for (Restaurant_Order_Item__c r : [SELECT Id FROM Restaurant_Order_Item__c WHERE Restaurant_Order__r.Order_Number__c = :orderNumber]) {
                rows.add(new Restaurant_Order_Item__c(Id = r.Id, Status__c = itemOutcome));
            }
            for (Database.SaveResult sr : Database.update(rows, false)) {
                if (!sr.isSuccess()) {
                    RestaurantOrderSync.lastError = 'item update: ' + sr.getErrors()[0].getStatusCode() + ' ' + sr.getErrors()[0].getMessage() + ' ' + sr.getErrors()[0].getFields();
                    System.debug(LoggingLevel.WARN, 'Restaurant order items were not updated: ' + RestaurantOrderSync.lastError);
                }
            }
        }
    }

    /**
     * One word per order for its dishes: SUCCESS (paid online, or confirmed pay-at-counter), FAILED, EXPIRED,
     * CANCELLED, otherwise PENDING. Derived only from the backend's own status values.
     */
    @TestVisible
    private static String outcome(String status, String paymentStatus) {
        if (status == 'CANCELLED') {
            return 'CANCELLED';
        }
        if (status == 'PAYMENT_FAILED' || paymentStatus == 'FAILED') {
            return 'FAILED';
        }
        if (status == 'EXPIRED' || paymentStatus == 'EXPIRED') {
            return 'EXPIRED';
        }
        if (paymentStatus == 'PAID' || paymentStatus == 'COD_PENDING' || paymentStatus == 'REFUND_REQUIRED' || paymentStatus == 'REFUNDED') {
            return 'SUCCESS';
        }
        return 'PENDING';
    }

    @TestVisible
    private static String summary(List<RestaurantOrderItem> items) {
        List<String> lines = new List<String>();
        for (RestaurantOrderItem i : items == null ? new List<RestaurantOrderItem>() : items) {
            lines.add(i.quantity + ' x ' + i.name + (i.lineTotal == null ? '' : ' = ' + i.lineTotal));
        }
        return String.join(lines, '\n');
    }

    private static String phoneOf(RestaurantOrderRequest req) {
        return req == null || String.isBlank(req.customerPhone) ? null : RestaurantApiService.normalisePhone(req.customerPhone);
    }

    private static Datetime parseTime(String iso) {
        if (String.isBlank(iso)) {
            return Datetime.now();
        }
        try {
            return (Datetime) JSON.deserialize('"' + iso + '"', Datetime.class);
        } catch (Exception e) {
            return Datetime.now();
        }
    }

    private static String firstNonBlank(String a, String b) {
        return String.isNotBlank(a) ? a : b;
    }

    @TestVisible
    private static String lastError;

    private static void warn(Exception e) {
        lastError = e.getMessage();
        System.debug(LoggingLevel.WARN, 'Restaurant order copy was not saved: ' + e.getMessage());
    }
}
