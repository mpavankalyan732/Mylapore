/**
 * Keeps a Salesforce copy (Restaurant_Order__c) of orders placed through the Mylapore card and agent.
 * PostgreSQL remains the source of truth: a failure here is logged and NEVER breaks or hides the real order.
 * Records are matched on the backend's order number (external id), so repeats and replays never duplicate.
 */
public with sharing class RestaurantOrderRecords {
    /** Saves a freshly placed order. Only runs when the backend created it (success and an order number). */
    public static void save(RestaurantOrderRequest req, RestaurantOrderResponse res) {
        if (res == null || res.success != true || String.isBlank(res.orderNumber)) {
            return;
        }
        Restaurant_Order__c rec = new Restaurant_Order__c(Order_Number__c = res.orderNumber);
        rec.Customer_Name__c = req?.customerName;
        rec.Customer_Phone__c = req?.customerPhone;
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
        upsertQuietly(rec);
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
    }

    /** Marks an order cancelled, only when the backend confirmed the cancellation. */
    public static void markCancelled(RestaurantCancellationResponse c) {
        if (c == null || c.cancelled != true || String.isBlank(c.orderNumber)) {
            return;
        }
        Restaurant_Order__c rec = new Restaurant_Order__c(Order_Number__c = c.orderNumber);
        rec.Status__c = String.isBlank(c.status) ? 'CANCELLED' : c.status;
        upsertQuietly(rec);
    }

    @TestVisible
    private static String summary(List<RestaurantOrderItem> items) {
        List<String> lines = new List<String>();
        for (RestaurantOrderItem i : items == null ? new List<RestaurantOrderItem>() : items) {
            lines.add(i.quantity + ' x ' + i.name + (i.lineTotal == null ? '' : ' = ' + i.lineTotal));
        }
        return String.join(lines, '\n');
    }

    private static String firstNonBlank(String a, String b) {
        return String.isNotBlank(a) ? a : b;
    }

    private static void upsertQuietly(Restaurant_Order__c rec) {
        try {
            Database.upsert(rec, Restaurant_Order__c.Order_Number__c, true);
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Restaurant order copy was not saved: ' + e.getMessage());
        }
    }
}
